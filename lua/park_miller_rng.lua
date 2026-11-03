-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: standard math/string functions.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}
local MODULUS = 2147483647
local RANGE = 2147483646
local ALGORITHM = "park-miller-16807-v1"

M.ALGORITHM = ALGORITHM

assert(16807.0 * 127772.0 == 2147464004.0,
    "unsupported arithmetic profile")
assert(2836.0 * 16806.0 == 47661816.0,
    "unsupported arithmetic profile")

local function integer(value, low, high)
    assert(type(value) == "number"
        and value == math.floor(value)
        and value >= low and value <= high,
        "integer outside supported range")
    return math.floor(value)
end

function M.new(seed)
    local state = integer(seed, 1, RANGE)
    local api = {}

    function api.next_integer()
        local high = math.floor(state / 127773)
        local low = state - high * 127773
        local next_state = 16807 * low - 2836 * high

        if next_state <= 0 then
            next_state = next_state + MODULUS
        end

        state = next_state
        return state
    end

    function api.integer(low, high)
        low = integer(low, -1000000, 1000000)
        high = integer(high, -1000000, 1000000)
        assert(low <= high, "inverted bounds")

        local width = high - low + 1
        local accepted = math.floor(RANGE / width) * width

        for _ = 1, 128 do
            local sample = api.next_integer() - 1
            if sample < accepted then
                return low + sample % width
            end
        end

        error("sampling budget exceeded; state has advanced")
    end

    function api.serialize()
        return ALGORITHM .. ":" .. string.format("%.0f", state)
    end

    return api
end

function M.restore(text)
    assert(type(text) == "string" and #text <= 64,
        "invalid serialized state")

    local prefix = ALGORITHM .. ":"
    assert(text:sub(1, #prefix) == prefix, "wrong RNG profile")

    local digits = text:sub(#prefix + 1)
    assert(digits:match("^[1-9][0-9]*$"), "invalid state encoding")

    local rng = M.new(tonumber(digits))
    assert(rng.serialize() == text, "noncanonical serialized state")
    return rng
end

return M
