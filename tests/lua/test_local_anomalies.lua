-- RUNTIME: standard Lua 5.1 / Lua 5.4.
-- Luau requires module-loading/output adapters.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local Loader = require("lua.scene_loader")
local RNG = require("lua.rng")
local Allen = require("lua.allen")
local Bell = require("lua.far_bell")
local Wheel = require("lua.mill_wheel")
local Clocks = require("lua.anomaly_clocks")

local records = {}
local registry = {
    read = function(handle)
        assert(records[handle], "foreign registry handle")
        return records[handle]
    end
}

local function registered(id, realm)
    local handle = {}
    records[handle] = { id = id, realm = realm }
    return handle
end

local bell = registered("far_bell", "parallel")
local tower = registered("far_tower", "parallel")
local beam = registered("invented_beam", "parallel")
local wheel = registered("far_mill_wheel", "parallel")
local race = registered("far_millrace", "parallel")
local laundry = registered("still_laundry", "parallel")
local leaves = registered("streaming_leaves", "parallel")

local hanging = Bell.new({
    registry = registry,
    bell = bell,
    tower = tower,
    null_value = Loader.NULL,
    supports = Loader.NULL
})

assert(hanging.placement().supports == Loader.NULL)
assert(hanging.placement().physical_support == "unestablished")
assert(hanging.attach_support(beam).code == "SUPPORT_REPAIR_FORBIDDEN")

assert(not pcall(function()
    Bell.new({
        registry = registry,
        bell = bell,
        tower = tower,
        null_value = Loader.NULL,
        supports = Loader.NULL,
        fallback_beam = beam
    })
end))

local turning = Wheel.new({
    registry = registry,
    wheel = wheel,
    millrace = race,
    rng = RNG,
    seed = 1,
    phase_slots = 360,
    slots_per_tick = 1,
    initial_shared_tick = 0
})

local initial = turning.snapshot().phase

for tick = 1, 5 do
    local result = turning.advance({shared_tick = tick})
    assert(result.status == "observed")
    assert(result.snapshot.phase == (initial + tick) % 360)
    assert(result.snapshot.flow_coupling == "none")
    assert(result.snapshot.physical_drive == "unestablished")
    assert(result.snapshot.depicted_relation ==
        "above_millrace_without_contact")
end

local before = turning.snapshot().phase
assert(turning.advance({
    shared_tick = 6,
    flow_speed = 100
}).code == "UNKNOWN_UPDATE_FIELD")
assert(turning.snapshot().phase == before)

local paired = Clocks.new({
    registry = registry,
    allen = Allen,
    laundry = laundry,
    leaves = leaves,
    initial_shared_tick = 0,
    leaf_phase_slots = 100,
    leaf_slots_per_tick = 1,
    initial_leaf_phase = 0,
    leaves_enabled = true
})

local frozen = paired.laundry_bytes()

paired.advance(1)
assert(paired.leaves_snapshot().phase == 1)
assert(paired.laundry_bytes() == frozen)

paired.set_leaves_enabled(false, 1)
paired.advance(5)
assert(paired.leaves_snapshot().phase == 1)
assert(paired.laundry_bytes() == frozen)

paired.set_leaves_enabled(true, 5)
paired.advance(6)
assert(paired.leaves_snapshot().phase == 2)
assert(paired.laundry_bytes() == frozen)

paired.set_leaves_enabled(false, 6)
paired.advance(10)
assert(paired.leaves_snapshot().phase == 2)
assert(paired.laundry_bytes() == frozen)

io.write("bell_support=null fallback_beam=rejected\n")
io.write("wheel_ticks=5 flow_input=rejected\n")
io.write("laundry_bytes=unchanged leaves_phase=2\n")
