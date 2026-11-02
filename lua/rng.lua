-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common arithmetic subset.
-- DEPENDENCIES: standard math and string functions only.
-- SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.
-- Procedural-art PRNGs only. Draws are not narrative ticks.

local M = {}

local PARK_MILLER = "park-miller-16807-v1"
local XORSHIFT32 = "xorshift32-13-17-5-v1"

local PM_MODULUS = 2147483647
local PM_MULTIPLIER = 16807
local PM_QUOTIENT = 127773
local PM_REMAINDER = 2836
local PM_SIZE = 2147483646

local U32 = 4294967296
local XS_SIZE = U32 - 1
local MAX_DRAWS = 9007199254740991

local MIN_BOUND = -1000000
local MAX_BOUND = 1000000
local MAX_ATTEMPTS = 128
local MAX_SERIALIZED_BYTES = 96

local floor = math.floor
local huge = math.huge

M.ALGORITHM = PARK_MILLER
M.DEFAULT_ALGORITHM = PARK_MILLER
M.ALGORITHMS = {
    PARK_MILLER = PARK_MILLER,
    XORSHIFT32 = XORSHIFT32
}
M.VERSION = "grimlore.rng.v2"

assert(16807.0 * 127772.0 == 2147464004.0,
    "rng: unsupported Park-Miller product arithmetic")
assert(2836.0 * 16806.0 == 47661816.0,
    "rng: unsupported Park-Miller remainder arithmetic")
assert(4294967295.0 - 1.0 == 4294967294.0,
    "rng: insufficient unsigned-32-bit numeric precision")
assert(9007199254740991.0 - 9007199254740990.0 == 1.0,
    "rng: insufficient draw-counter numeric precision")

local function integer(value, low, high, label)
    if type(value) ~= "number"
        or value ~= value
        or value == huge
        or value == -huge
        or value < low
        or value > high
        or value ~= floor(value)
    then
        error("rng: invalid " .. label, 3)
    end

    return floor(value)
end

local function decimal(value)
    return string.format("%.0f", value)
end

local function select_algorithm(algorithm)
    if algorithm == nil then
        return PARK_MILLER
    end

    if algorithm ~= PARK_MILLER and algorithm ~= XORSHIFT32 then
        error("rng: unsupported algorithm", 3)
    end

    return algorithm
end

local function bxor32(a, b)
    local result = 0
    local bit = 1

    for _ = 1, 32 do
        local aa = a % 2
        local bb = b % 2

        if aa ~= bb then
            result = result + bit
        end

        a = floor(a / 2)
        b = floor(b / 2)
        bit = bit * 2
    end

    return result
end

local function left32(value, count)
    return (value % (2 ^ (32 - count))) * (2 ^ count)
end

local function right32(value, count)
    return floor(value / (2 ^ count))
end

local function park_miller_step(state)
    local high = floor(state / PM_QUOTIENT)
    local low = state - high * PM_QUOTIENT

    local next_state =
        PM_MULTIPLIER * low - PM_REMAINDER * high

    if next_state <= 0 then
        next_state = next_state + PM_MODULUS
    end

    return next_state
end

local function xorshift32_step(state)
    local value = bxor32(state, left32(state, 13))
    value = bxor32(value, right32(value, 17))
    return bxor32(value, left32(value, 5))
end

local function construct(algorithm, initial_state, initial_draws)
    local is_xorshift = algorithm == XORSHIFT32
    local population = is_xorshift and XS_SIZE or PM_SIZE

    local state = integer(
        initial_state,
        1,
        population,
        "seed or state"
    )

    local draws = 0
    if is_xorshift then
        draws = integer(
            initial_draws or 0,
            0,
            MAX_DRAWS,
            "draw count"
        )
    end

    local step = is_xorshift and xorshift32_step or park_miller_step
    local api = {}

    function api.next_integer()
        if is_xorshift and draws >= MAX_DRAWS then
            error("rng: draw counter exhausted", 2)
        end

        state = step(state)

        if is_xorshift then
            draws = draws + 1
        end

        return state
    end

    function api.integer(low, high)
        low = integer(low, MIN_BOUND, MAX_BOUND, "lower bound")
        high = integer(high, MIN_BOUND, MAX_BOUND, "upper bound")

        if low > high then
            error("rng: inverted integer bounds", 2)
        end

        local width = high - low + 1
        local accepted = floor(population / width) * width

        -- Every attempt consumes a draw, including width-one requests.
        for _ = 1, MAX_ATTEMPTS do
            local sample = api.next_integer() - 1

            if sample < accepted then
                return low + sample % width
            end
        end

        error("rng: sampling budget exhausted; state has advanced", 2)
    end

    function api.serialize()
        if is_xorshift then
            return algorithm .. ":" ..
                decimal(state) .. ":" .. decimal(draws)
        end

        return algorithm .. ":" .. decimal(state)
    end

    function api.algorithm()
        return algorithm
    end

    function api.clone()
        return construct(algorithm, state, draws)
    end

    return api
end

function M.new(seed, algorithm)
    algorithm = select_algorithm(algorithm)
    return construct(algorithm, seed, 0)
end

function M.new_park_miller(seed)
    return construct(PARK_MILLER, seed, 0)
end

function M.new_xorshift32(seed)
    return construct(XORSHIFT32, seed, 0)
end

function M.restore(text)
    if type(text) ~= "string"
        or #text == 0
        or #text > MAX_SERIALIZED_BYTES
    then
        error("rng: invalid serialized state", 2)
    end

    local pm_prefix = PARK_MILLER .. ":"
    local xs_prefix = XORSHIFT32 .. ":"
    local restored

    if text:sub(1, #pm_prefix) == pm_prefix then
        local digits = text:sub(#pm_prefix + 1)

        if not digits:match("^[1-9][0-9]*$") then
            error("rng: invalid Park-Miller state encoding", 2)
        end

        restored = construct(PARK_MILLER, tonumber(digits), 0)

    elseif text:sub(1, #xs_prefix) == xs_prefix then
        local state_text, draws_text = text:sub(#xs_prefix + 1):match(
            "^([1-9][0-9]*):([0-9]+)$"
        )

        if not state_text or not draws_text then
            error("rng: invalid xorshift32 state encoding", 2)
        end

        restored = construct(
            XORSHIFT32,
            tonumber(state_text),
            tonumber(draws_text)
        )

    else
        error("rng: unknown serialized algorithm", 2)
    end

    if restored.serialize() ~= text then
        error("rng: noncanonical serialized state", 2)
    end

    return restored
end

function M.self_test()
    local checks = 0

    local function check(condition, message)
        checks = checks + 1
        assert(condition, "rng self-test: " .. message)
    end

    local function rejects(callback, message)
        local ok = pcall(callback)
        check(not ok, message)
    end

    local pm = M.new_park_miller(1)
    local pm_expected = {
        16807,
        282475249,
        1622650073,
        984943658,
        1144108930
    }

    for _, expected in ipairs(pm_expected) do
        check(pm.next_integer() == expected, "Park-Miller vector mismatch")
    end

    pm = M.new_park_miller(1)
    local last

    for _ = 1, 10000 do
        last = pm.next_integer()
    end

    check(last == 1043618065, "Park-Miller 10000-step mismatch")

    local xs = M.new_xorshift32(1)
    local xs_expected = {
        270369,
        67634689,
        2647435461,
        307599695,
        2398689233
    }

    for _, expected in ipairs(xs_expected) do
        check(xs.next_integer() == expected, "xorshift32 vector mismatch")
    end

    for _, algorithm in ipairs({ PARK_MILLER, XORSHIFT32 }) do
        local original = M.new(17, algorithm)

        for _ = 1, 11 do
            original.next_integer()
        end

        local saved = original.serialize()
        local restored = M.restore(saved)
        local copied = original.clone()

        check(restored.serialize() == saved, "restore changed state")
        check(copied.serialize() == saved, "clone changed state")

        for _ = 1, 32 do
            local expected = original.next_integer()
            check(restored.next_integer() == expected,
                "restored sequence diverged")
            check(copied.next_integer() == expected,
                "cloned sequence diverged")
        end

        local samples = M.new(123, algorithm)
        local seen = {}

        for _ = 1, 1000 do
            local value = samples.integer(1, 10)
            check(value >= 1 and value <= 10,
                "bounded integer escaped its range")
            seen[value] = true
        end

        for value = 1, 10 do
            check(seen[value] == true, "range sanity check missed a value")
        end

        local fixed = M.new(1, algorithm)
        local advanced = M.new(1, algorithm)
        advanced.next_integer()

        check(fixed.integer(7, 7) == 7, "width-one result incorrect")
        check(fixed.serialize() == advanced.serialize(),
            "width-one request did not consume one draw")

        for _, invalid in ipairs({ 0, -1, 1.5, huge, -huge }) do
            rejects(function()
                M.new(invalid, algorithm)
            end, "invalid seed accepted")
        end

        rejects(function()
            M.new(0 / 0, algorithm)
        end, "NaN seed accepted")

        rejects(function()
            M.new(1, algorithm).integer(5, 3)
        end, "inverted bounds accepted")

        rejects(function()
            M.new(1, algorithm).integer(0, 0.5)
        end, "fractional bound accepted")

        rejects(function()
            M.new(1, algorithm).integer(MIN_BOUND - 1, 0)
        end, "out-of-range bound accepted")
    end

    rejects(function()
        M.new_park_miller(PM_MODULUS)
    end, "Park-Miller modulus accepted as seed")

    rejects(function()
        M.new_xorshift32(U32)
    end, "xorshift32 overflow seed accepted")

    rejects(function()
        M.new(1, "unknown-generator")
    end, "unknown algorithm accepted")

    rejects(function()
        M.restore(PARK_MILLER .. ":01")
    end, "noncanonical Park-Miller state accepted")

    rejects(function()
        M.restore(XORSHIFT32 .. ":1:00")
    end, "noncanonical xorshift32 draw count accepted")

    rejects(function()
        M.restore(XORSHIFT32 .. ":0:0")
    end, "zero xorshift32 state accepted")

    rejects(function()
        M.restore(XORSHIFT32 .. ":1:" .. decimal(MAX_DRAWS) .. "0")
    end, "overflow draw count accepted")

    local exhausted = M.restore(
        XORSHIFT32 .. ":1:" .. decimal(MAX_DRAWS)
    )
    local exhausted_state = exhausted.serialize()

    rejects(function()
        exhausted.next_integer()
    end, "exhausted draw counter advanced")

    check(exhausted.serialize() == exhausted_state,
        "failed draw changed exhausted state")

    local default = M.new(1)
    check(default.algorithm() == PARK_MILLER,
        "default algorithm compatibility changed")
    check(default.next_integer() == 16807,
        "default generator sequence changed")

    return {
        status = "passed",
        checks = checks,
        module_version = M.VERSION,
        algorithms = { PARK_MILLER, XORSHIFT32 }
    }
end

return M
