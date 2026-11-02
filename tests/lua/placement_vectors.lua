-- RUNTIME: Lua 5.1 and Lua 5.4.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/workstream metadata only; not identity, consent,
-- authorization, or execution evidence.

local RNG = require("lua.rng")
local placement = require("lua.place_clay_houses")

local expected = {
    16807, 282475249, 1622650073, 984943658, 1144108930
}

local random = RNG.new(1)
for _, value in ipairs(expected) do
    assert(random.next_integer() == value, "PRNG vector mismatch")
end

random = RNG.new(1)
local last
for _ = 1, 10000 do
    last = random.next_integer()
end
assert(last == 1043618065, "10000-step PRNG vector mismatch")

local restored = RNG.restore(random.serialize())
assert(restored.next_integer() == random.next_integer(),
    "restored sequence differs")

local result = placement.generate({
    seed = 1,
    count = 8,
    spacing = 24,
    jitter = 2,
    width = 12,
    origin_x = 0,
    origin_y = 0
})

local absent = 0
for index, house in ipairs(result.houses) do
    assert(house.authenticity == "fictional")
    if not house.wax_plug then absent = absent + 1 end

    if index > 1 then
        local previous = result.houses[index - 1]
        assert(house.x - previous.x >= house.width,
            "houses overlap")
    end
end
assert(absent == 1, "exactly one wax plug must be absent")

io.write(placement.serialize(result))
