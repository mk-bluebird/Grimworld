-- RUNTIME: Lua 5.1 and Lua 5.4 common subset; no engine APIs.
-- NUMERIC PROFILE: double-precision-or-better arithmetic required.
-- DEPENDENCIES: Lua standard math/string libraries only.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/workstream metadata only; not identity, consent,
-- authorization, or execution evidence.

local M = {}

local MODULUS = 2147483647
local MULTIPLIER = 16807
local QUOTIENT = 127773
local REMAINDER = 2836
local RANGE = MODULUS - 1
local ALGORITHM = "park-miller-16807-v1"

assert((2 ^ 32 + 1) - 2 ^ 32 == 1,
    "unsupported numeric profile: sufficient precision required")

local function integer(value, low, high, label)
    assert(type(value) == "number"
        and value == math.floor(value)
        and value >= low
        and value <= high,
        label .. " outside supported integer range")
    return value
end

function M.new(seed)
    local state = integer(seed, 1, RANGE, "seed")
    local api = {}

    function api.next_integer()
        local high = math.floor(state / QUOTIENT)
        local low = state - high * QUOTIENT
        local next_state =
            MULTIPLIER * low - REMAINDER * high

        if next_state <= 0 then
            next_state = next_state + MODULUS
        end

        state = next_state
        return state
    end

    function api.integer(low, high)
        integer(low, -1000000, 1000000, "lower bound")
        integer(high, -1000000, 1000000, "upper bound")
        assert(low <= high, "inverted bounds")

        local width = high - low + 1
        local accepted = math.floor(RANGE / width) * width

        -- Rejection sampling avoids modulo bias.
        -- Exhaustion is explicit, never an unbounded loop.
        for _ = 1, 128 do
            local sample = api.next_integer() - 1
            if sample < accepted then
                return low + sample % width
            end
        end

        error("random sampling budget exceeded")
    end

    function api.serialize()
        return ALGORITHM .. ":" .. string.format("%d", state)
    end

    return api
end

function M.restore(serialized)
    assert(type(serialized) == "string", "state must be a string")
    local prefix = ALGORITHM .. ":"
    assert(string.sub(serialized, 1, #prefix) == prefix,
        "unsupported generator state")

    local digits = string.sub(serialized, #prefix + 1)
    assert(string.match(digits, "^[1-9][0-9]*$"),
        "invalid serialized seed")

    local result = M.new(tonumber(digits))
    assert(result.serialize() == serialized,
        "noncanonical serialized seed")
    return result
end

M.ALGORITHM = ALGORITHM
return M
