-- RUNTIME: standard Lua 5.1 / Lua 5.4.
-- Luau requires host-specific module-loading/output adapters.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local Counterpart = require("lua.counterpart")
local Correspondence = require("lua.correspondence")
local Lantern = require("lua.lantern")
local RNG = require("lua.rng")

local records = {}
local registry = {
    read = function(handle)
        assert(records[handle], "foreign handle")
        return records[handle]
    end
}

local function registered(id, realm, attributes)
    local handle = {}
    records[handle] = {
        id = id, realm = realm, attributes = attributes or {}
    }
    return handle
end

local widow = registered("widow", "living", {
    head_inclination = "paired_unspecified_angle",
    coat_motif = "widow_coat",
    shoulder_repair = "source_side",
    lantern_state = "lit",
    held_object = "house_key"
})

local other = registered("counterpart", "parallel", {
    head_inclination = "paired_unspecified_angle",
    coat_motif = "widow_coat",
    shoulder_repair = "opposite_source_side",
    lantern_state = "unlit",
    held_object = "open_lock"
})

local pair = Counterpart.new({
    registry = registry,
    correspondence = Correspondence,
    owner = widow,
    counterpart = other
})

local opposite = {
    left = "right",
    right = "left",
    source_side = "opposite_source_side",
    opposite_source_side = "source_side"
}

local random = RNG.new(71)
local sides = {"left", "right", "source_side", "opposite_source_side"}

for index = 1, 300 do
    local result = pair.update(widow, {
        head_inclination = "authored_angle_group_" .. index,
        coat_motif = "authored_coat_motif_" .. random.integer(1, 9),
        shoulder_repair = sides[random.integer(1, #sides)]
    })

    assert(result.status == "updated")
    local snapshot = result.snapshot
    local a, b = snapshot.owner, snapshot.counterpart

    assert(a.head_inclination == b.head_inclination)
    assert(a.coat_motif == b.coat_motif)
    assert(b.shoulder_repair == opposite[a.shoulder_repair])
    assert(a.lantern_state == "lit" and b.lantern_state == "unlit")
    assert(a.held_object == "house_key" and b.held_object == "open_lock")
    assert(snapshot.basis == "implementation_choice")
end

local revision = pair.snapshot().revision

assert(pair.update(widow, {lantern_state="unlit"}).code ==
    "LANTERN_ASYMMETRY_LOCKED")
assert(pair.update(widow, {held_object="open_lock"}).code ==
    "OBJECT_ASYMMETRY_LOCKED")
assert(pair.update(other, {head_inclination="changed"}).code ==
    "UPDATE_SCOPE_DENIED")
assert(pair.snapshot().revision == revision)

-- Source registry records were not rewritten by authored updates.
assert(registry.read(widow).attributes.head_inclination ==
    "paired_unspecified_angle")

local reflection = registered("widow_reflection", "river")
local doorstep = registered("submerged_doorstep", "river")
local river_object = registered("unlisted_river_object", "river")
local near_bank = registered("near_bank", "living")

local submerged_light = Lantern.new({
    id = "submerged_lantern_light",
    registry = registry,
    source = reflection,
    enabled = true,
    emission_description = "Burns underwater, revealing a submerged doorstep.",
    allowed_target_realms = {"river"},
    allowed_targets = {doorstep},
    scope_reason =
        "Authored policy limiting this light to its selected river target."
})

assert(submerged_light.inspect().source_realm == "river")
assert(submerged_light.affects(doorstep).status == "eligible")
assert(submerged_light.affects(near_bank).code == "TARGET_REALM_DENIED")
assert(submerged_light.affects(river_object).code ==
    "TARGET_NOT_ALLOWLISTED")
assert(submerged_light.affects({}).code == "FOREIGN_TARGET_HANDLE")

io.write("counterpart_updates=300 scoped_light_tests=passed\n")
