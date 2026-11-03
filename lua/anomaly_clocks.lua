-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: injected entity registry and allen.lua.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}
local MAX_TICK = 9007199254740991

local function integer(value, low, high)
    assert(type(value) == "number"
        and value == math.floor(value)
        and value >= low and value <= high,
        "integer outside supported range")
    return math.floor(value)
end

function M.new(config)
    local registry = config.registry
    local Allen = config.allen

    local laundry = registry.read(config.laundry)
    local leaves = registry.read(config.leaves)
    assert(config.laundry ~= config.leaves,
        "laundry and leaves identities must differ")

    local tick = integer(config.initial_shared_tick, 0, MAX_TICK)
    local slots = integer(config.leaf_phase_slots, 2, 1000000)
    local rate = integer(config.leaf_slots_per_tick, 1, slots - 1)
    local phase = integer(config.initial_leaf_phase, 0, slots - 1)

    assert(type(config.leaves_enabled) == "boolean",
        "explicit leaves-enabled state required")
    local enabled = config.leaves_enabled
    local api = {}

    function api.laundry_snapshot()
        -- No timestamp or leaf field belongs in this frozen snapshot.
        return {
            id = laundry.id,
            motion = "still",
            phase = 0,
            basis = "explicit_description",
            policy = "frozen"
        }
    end

    function api.laundry_bytes()
        -- Fixed state serialization for the regression invariant.
        -- This intentionally excludes runtime time and mutable leaf state.
        return "grimlore.laundry-state.v1\nmotion=still\nphase=0\n"
    end

    function api.leaves_snapshot()
        return {
            id = leaves.id,
            motion = "horizontal_stream",
            motion_basis = "explicit_description",
            phase = phase,
            phase_slots = slots,
            phase_basis = "implementation_choice",
            enabled = enabled,
            shared_tick = tick
        }
    end

    local function advance(next_tick)
        if type(next_tick) ~= "number"
            or next_tick ~= math.floor(next_tick)
            or next_tick < tick or next_tick > MAX_TICK then
            return { status = "rejected", code = "INVALID_SHARED_TICK" }
        end

        local consumed
        if next_tick > tick then
            consumed = { start = tick, ["end"] = next_tick }
            assert(Allen.validate(consumed), "invalid shared tick interval")

            if enabled then
                local delta = next_tick - tick
                phase = (phase + (delta % slots) * rate) % slots
            end
        end

        -- Always consume elapsed ticks, including when leaves are paused.
        tick = next_tick

        return {
            status = "observed",
            consumed_interval = consumed,
            leaves = api.leaves_snapshot(),
            laundry = api.laundry_snapshot()
        }
    end

    function api.advance(shared_tick)
        return advance(shared_tick)
    end

    function api.set_leaves_enabled(value, at_tick)
        if type(value) ~= "boolean" then
            return { status = "rejected", code = "BOOLEAN_REQUIRED" }
        end

        local result = advance(at_tick)
        if result.status == "rejected" then return result end

        enabled = value
        return {
            status = "policy_updated",
            shared_tick = tick,
            leaves = api.leaves_snapshot(),
            laundry = api.laundry_snapshot(),
            basis = "implementation_choice"
        }
    end

    return api
end

return M
