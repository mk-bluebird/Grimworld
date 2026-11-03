-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: injected registry and rng.lua module.
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
    assert(type(config) == "table" and getmetatable(config) == nil,
        "plain configuration required")

    local allowed = {
        registry = true, wheel = true, millrace = true,
        rng = true, seed = true, phase_slots = true,
        slots_per_tick = true, initial_shared_tick = true
    }
    for key in pairs(config) do
        assert(allowed[key], "unknown wheel configuration field")
    end

    local wheel = config.registry.read(config.wheel)
    local race = config.registry.read(config.millrace)
    assert(config.wheel ~= config.millrace,
        "wheel and millrace must be distinct")

    local slots = integer(config.phase_slots, 2, 1000000)
    local rate = integer(config.slots_per_tick, 1, slots - 1)
    local tick = integer(config.initial_shared_tick, 0, MAX_TICK)

    local random = config.rng.new(config.seed)
    local phase = random.integer(0, slots - 1)
    local rng_state = random.serialize()
    local api = {}

    function api.snapshot()
        return {
            profile = "grimlore.mill-wheel.v1",
            wheel_id = wheel.id,
            millrace_id = race.id,
            shared_tick = tick,
            phase = phase,
            phase_slots = slots,
            slots_per_tick = rate,
            phase_basis = "implementation_choice",
            initial_rng_state = rng_state,

            depicted_relation = "above_millrace_without_contact",
            relation_basis = "explicit_description",
            physical_drive = "unestablished",
            flow_coupling = "none"
        }
    end

    function api.advance(request)
        if type(request) ~= "table" or getmetatable(request) ~= nil then
            return { status = "rejected", code = "INVALID_TICK_REQUEST" }
        end

        for key in pairs(request) do
            if key ~= "shared_tick" then
                return { status = "rejected", code = "UNKNOWN_UPDATE_FIELD" }
            end
        end

        local next_tick = request.shared_tick
        if type(next_tick) ~= "number"
            or next_tick ~= math.floor(next_tick)
            or next_tick < tick or next_tick > MAX_TICK then
            return { status = "rejected", code = "INVALID_SHARED_TICK" }
        end

        local delta = next_tick - tick

        -- Reduce before multiplication; product stays below 10^12.
        phase = (phase + (delta % slots) * rate) % slots
        tick = next_tick

        return { status = "observed", snapshot = api.snapshot() }
    end

    return api
end

return M
