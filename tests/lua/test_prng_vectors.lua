-- RUNTIME: Lua 5.1 / Lua 5.4 common subset; standard numeric builds.
-- SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local R = require("lua.rng")
local P = require("lua.place_clay_houses")
local function rejects(f) assert(not pcall(f), "expected rejection") end
for _, seed in ipairs({0, -1, 2147483647, 2147483648, 1.5}) do
    rejects(function() R.new(seed) end)
end
local rng = R.new(1.0)
if math.type then assert(math.type(rng.next_integer()) == "integer") end
rng = R.new(1)
for _, v in ipairs({16807,282475249,1622650073,984943658,1144108930}) do
    assert(rng.next_integer() == v, "vector mismatch")
end
rng = R.new(1)
local last
for _ = 1,10000 do last = rng.next_integer() end
assert(last == 1043618065)
local saved = rng.serialize()
assert(R.restore(saved).next_integer() == rng.next_integer())
rejects(function() R.restore("park-miller-16807-v1:01") end)
rejects(function() rng.integer(5,3) end)
rejects(function() rng.integer(0,0.5) end)
local seen = {}
for _ = 1,1000 do
    local n = rng.integer(1,10)
    assert(n >= 1 and n <= 10); seen[n] = true
end
for i = 1,10 do assert(seen[i]) end
local c = {seed=1,count=8,spacing=24,jitter=2,width=12,origin_x=0,origin_y=0}
local text = P.serialize(P.generate(c))
assert(text == P.serialize(P.generate(c)), "repeatability failed")
assert(P.serialize(P.parse(text)) == text, "roundtrip failed")
local one = {seed=1,count=1,spacing=24,jitter=2,width=12,origin_x=0,origin_y=0}
assert(P.generate(one).final_rng_state == "park-miller-16807-v1:1622650073", "draw order changed")
local broken = text:gsub("authenticity=fictional\n", "", 1)
rejects(function() P.parse(broken) end)
broken = text:gsub("\tfictional\tintentionally_open", "\tintentionally_open", 1)
rejects(function() P.parse(broken) end)
broken = text:gsub("grimlore.authenticity.v1", "grimlore.authenticity.v99", 1)
rejects(function() P.parse(broken) end)
local bad = P.generate(c); bad.label = "fictional\nforged=true"
rejects(function() P.serialize(bad) end)
local result = P.generate(c)
for i=2,#result.houses do
    assert(result.houses[i].x-result.houses[i-1].x >= c.width)
end
