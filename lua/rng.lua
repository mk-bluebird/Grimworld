-- RUNTIME: Lua 5.1 / Lua 5.4 common subset; standard numeric builds.
-- SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}
local MOD, A, Q, R, SIZE = 2147483647, 16807, 127773, 2836, 2147483646
M.ALGORITHM = "park-miller-16807-v1"
-- Targeted arithmetic sentinels; not a proof of an arbitrary numeric build.
assert(16807.0 * 127772.0 == 2147464004.0, "numeric product unsupported")
assert(2836.0 * 16806.0 == 47661816.0, "numeric product unsupported")
assert(2147483647.0 - 1.0 == 2147483646.0, "numeric range unsupported")
local function integer(v, low, high)
    assert(type(v) == "number" and v == v and v ~= math.huge
        and v ~= -math.huge and v == math.floor(v)
        and v >= low and v <= high, "invalid integer")
    return math.floor(v)
end
function M.new(seed)
    local state = integer(seed, 1, SIZE)
    local api = {}
    function api.next_integer()
        local hi = math.floor(state / Q)
        local lo = state - hi * Q
        local next_state = A * lo - R * hi
        if next_state <= 0 then next_state = next_state + MOD end
        state = next_state
        return state
    end
    function api.integer(low, high)
        low, high = integer(low, -1000000, 1000000), integer(high, -1000000, 1000000)
        assert(low <= high, "inverted bounds")
        local width = high - low + 1
        local accepted = math.floor(SIZE / width) * width
        -- SIZE equipotential states, mapped to samples 0 .. SIZE-1.
        -- Actual stream is deterministic: no IID exhaustion bound claimed.
        for _ = 1, 128 do
            local sample = api.next_integer() - 1
            if sample < accepted then return low + sample % width end
        end
        error("sampling budget exceeded; state has advanced")
    end
    function api.serialize()
        return M.ALGORITHM .. ":" .. string.format("%d", state)
    end
    return api
end
function M.restore(text)
    assert(type(text) == "string" and #text <= 64, "invalid state")
    local prefix = M.ALGORITHM .. ":"
    assert(text:sub(1, #prefix) == prefix, "unknown algorithm")
    local digits = text:sub(#prefix + 1)
    assert(digits:match("^[1-9][0-9]*$"), "invalid state encoding")
    local rng = M.new(tonumber(digits))
    assert(rng.serialize() == text, "noncanonical state")
    return rng
end
return M
