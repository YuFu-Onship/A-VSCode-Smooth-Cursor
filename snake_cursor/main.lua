--cursor----------------------------------------
local Cursor={}
Cursor.__index=Cursor
function Cursor:new(x,y)
    local self=setmetatable({},Cursor)
    self.canvas=self:return_canvas()
    
    self.target_position_set=self:init_random_target_position()
    self.target_position_node={}
    for i=1,108 do
        table.insert(self.target_position_node,self.target_position_set[i].x)
        table.insert(self.target_position_node,self.target_position_set[i].y)
        table.insert(self.target_position_node,0)
        table.insert(self.target_position_node,self.target_position_set[i].y)
    end
    self.target_position=self.target_position_set[1]
    self.position=self.target_position_set[1]
    self.is_move=false
    self.vx,self.vy=0,0
    self.node=1
    self.alpha=1
    self.timer=0
    return self
end

function Cursor:update(dt)
    self:update_position(dt)
    self.timer=self.timer+dt*3
    self.alpha=math.abs(math.cos(self.timer))
    if self.timer>=math.pi then self.timer=0 end
end

function Cursor:draw()
    love.graphics.setColor(0.5,0.5,0.5,1)
    love.graphics.line(unpack(self.target_position_node))
    love.graphics.setColor(1,1,1,self.alpha)
    love.graphics.draw(self.canvas,self.position.x,self.position.y,0,1,1,8,15)
    love.graphics.setColor(1,1,1,1)
end

function Cursor:return_canvas()
    local canvas=love.graphics.newCanvas(16,30)
    love.graphics.setCanvas(canvas)
    love.graphics.setColor(1,1,1,1)
    love.graphics.rectangle("fill",0,0,16,30)
    love.graphics.setCanvas()
    return canvas
end

function Cursor:update_position(dt)
    if love.mouse.isDown(1) then
        local mouseX, mouseY = love.mouse.getPosition()
        self.node = math.floor(mouseY*0.1)+1
        self.target_position = self.target_position_set[self.node]
    end

    local vec_x = self.target_position.x - self.position.x
    local vec_y = self.target_position.y - self.position.y

    local move_time = 0.1
    local vx = vec_x / move_time * dt
    local vy = vec_y / move_time * dt

    -- 防止超越
    if math.abs(vec_x) <= math.abs(vx) then vx = vec_x end
    if math.abs(vec_y) <= math.abs(vy) then vy = vec_y end

    self.position.x = self.position.x + vx
    self.position.y = self.position.y + vy
end

function Cursor:init_random_target_position()
    local position={}
    local n=1
    for i=1,108 do
        local x=math.random()*700
        local y=10*i*n
        table.insert(position,{x=x,y=y})
    end
    return position
end

function Cursor:return_move_vec()
    local vec_x=self.target_position.x-self.position.x
    local vec_y=self.target_position.y-self.position.y
    local dist=math.sqrt(vec_x*vec_x+vec_y*vec_y)
    if dist<=1e2 then
        return 0,0
    else
        local vx=vec_x/12
        local vy=vec_y/12
        return vx,vy
    end
end

function Cursor:api_return_xy()
    return self.position.x,self.position.y
end
--anchor----------------------------------------
--anchor---------------------------------------
local Anchor={}
Anchor.__index=Anchor
function Anchor:new(x,y)
    local self=setmetatable({},Anchor)
    self.tar_x=x or 100
    self.tar_y=y or 100
    self.cur_x=self.tar_x
    self.cur_y=self.tar_y
    self.min_node=0
    self.max_node=20
    self.cur_node=self.min_node
    self.nodes={}
    for i=1,12 do
        table.insert(self.nodes,{x=self.cur_x,y=self.cur_y,r=3})
    end
    
    self.is_motionless=true
    self.is_move=false
    self.last_position={x=self.tar_x,y=self.tar_y}
    self.start_point={x=self.cur_x,y=self.cur_y}

    self.trajectory_timer=0
    self.trajectory_nodes={}
    return self
end
function Anchor:update(dt)
    local dx=self.tar_x-self.last_position.x
    local dy=self.tar_y-self.last_position.y
    local dist=math.sqrt(dx*dx+dy*dy)
    if dist<=1 then
        self.is_move=false
        self.head_position={x=self.tar_x,y=self.tar_y}
        self.start_point={x=self.tar_x,y=self.tar_y}
    else
        self.is_move=true
        if #self.nodes==0 then
            table.insert(self.nodes,{x=self.tar_x,y=self.tar_y,r=10})
        end
    end
    
    if #self.nodes>=1 then
        if not self.is_move and #self.nodes>=1 then
            table.remove(self.nodes,1)
        elseif self.is_move and #self.nodes<=20 then
            local tail_point=self.nodes[#self.nodes]
            local tas_vec_x=tail_point.x-self.start_point.x
            local tas_vec_y=tail_point.y-self.start_point.y
            local tas_dist=math.sqrt(tas_vec_x^2+tas_vec_y^2)
            if tas_dist>=10 then
                table.insert(self.nodes,{x=self.start_point.x,y=self.start_point.y,r=10})
            end
        end
    end
    
    local vx,vy=0,0
    if #self.nodes>=1 then
        self.nodes[1].x,self.nodes[1].y=self.tar_x,self.tar_y
        if #self.nodes>=2 then
            for i=2,#self.nodes do
                self.nodes[i].x,self.nodes[i].y=self:__compute_next_position(self.nodes[i-1],self.nodes[i],10)
            end
        end
    end
    
    self.last_position.x=self.tar_x
    self.last_position.y=self.tar_y
    self:__trajectory_update(dt)
end

function Anchor:draw()
    love.graphics.setColor(1,1,1,1)
    love.graphics.print("H",self.cur_x,self.cur_y)
    for i,n in ipairs(self.nodes)do
        -- love.graphics.circle("fill",n.x,n.y,12)
    end
    if #self.nodes>=2 then
        for i=1,#self.nodes-1 do
            love.graphics.line(self.nodes[i].x,self.nodes[i].y,self.nodes[i+1].x,self.nodes[i+1].y)
        end
    end
    -- love.graphics.setColor(1,0,1,1)
    -- self:__trajectory_draw()
end

function Anchor:__compute_next_position(a,b,s)
    local vec={b.x-a.x,b.y-a.y}
    if math.abs(vec[1])<=1e-6 and math.abs(vec[2])<=1e-6 then vec[1]=s vec[2]=0 end
    local dist=math.sqrt(vec[1]^2+vec[2]^2)
    return
        a.x+vec[1]/dist * s,
        a.y+vec[2]/dist * s
end

function Anchor:__trajectory_update(dt)
    self.trajectory_timer=self.trajectory_timer+dt
    if self.trajectory_timer>=0.05 then
        table.insert(self.trajectory_nodes,{x=self.tar_x,y=self.tar_y})
    end
    if #self.trajectory_nodes>=20 then
        table.remove(self.trajectory_nodes,1)
    end
    if not self.is_move then
        table.remove(self.trajectory_nodes,1)
    end

end
function Anchor:__trajectory_draw()
    if #self.trajectory_nodes>=2 then
        for i=1,#self.trajectory_nodes-1 do
            love.graphics.line(self.trajectory_nodes[i].x,self.trajectory_nodes[i].y,self.trajectory_nodes[i+1].x,self.trajectory_nodes[i+1].y)
        end
    end
end

function Anchor:api_tar_pos(x,y)
    self.tar_x=x
    self.tar_y=y
end

--love------------------------------------------
local  cursor
local anchor
function love.load()
    love.window.setMode(1920,1080)
    love.graphics.setLineWidth(20)
    cursor=Cursor:new(0,0)
    anchor=Anchor:new()
end
function love.update(dt)
    cursor:update(dt)
    anchor:update(dt)
    local cx,cy=cursor:api_return_xy()
    anchor:api_tar_pos(cx,cy)
end
function love.draw()
    cursor:draw()
    anchor:draw()
end