-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: none.
--
-- ERROR POLICY:
-- validate / is_valid_relation return booleans.
-- Invalid operational arguments raise errors.
-- intersection / clip return nil for no positive-duration intersection.
-- split returns nil for a valid integer split outside the interior.
-- Enumeration requires an explicit output budget before iteration.
--
-- DOMAIN:
-- Nonempty half-open intervals with explicit raw fields:
--   0 <= start < end <= MAX_ENDPOINT.
-- MAX_ENDPOINT itself is an allowed endpoint.
-- This module does not represent mathematical point intervals.
--
-- COMPOSITION:
-- Standard qualitative Allen composition, not a full constraint-network
-- solver or a guarantee of realizability for fixed bounded endpoints.
--
-- SOURCE:
-- Composition table: Thomas Alspaugh, Allen's Interval Algebra, Table 4a.
-- https://ics.uci.edu/~alspaugh/cls/shr/allen.html
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}
local MAX_ENDPOINT = 9007199254740991
local FULL_MASK = 8191

M.MAX_ENDPOINT = MAX_ENDPOINT
M.MASK_PROFILE = "grimlore.allen-mask.v1"

-- Stable zero-based bit positions, matching the original witness order.
local ORDER = {
    "before", "meets", "overlaps", "starts", "during", "finishes",
    "equals", "after", "met_by", "overlapped_by", "started_by",
    "contains", "finished_by"
}

local INVERSE = {
    before = "after",
    after = "before",
    meets = "met_by",
    met_by = "meets",
    overlaps = "overlapped_by",
    overlapped_by = "overlaps",
    starts = "started_by",
    started_by = "starts",
    during = "contains",
    contains = "during",
    finishes = "finished_by",
    finished_by = "finishes",
    equals = "equals"
}

local INDEX, BITS = {}, {}
for index, name in ipairs(ORDER) do
    INDEX[name] = index
    BITS[index] = 2 ^ (index - 1)
end

local function integer(value, low, high)
    return type(value) == "number"
        and value >= low
        and value <= high
        and value == math.floor(value)
end

local function endpoints(interval)
    if type(interval) ~= "table" then return nil, nil end

    local first = rawget(interval, "start")
    local last = rawget(interval, "end")

    if not integer(first, 0, MAX_ENDPOINT)
        or not integer(last, 0, MAX_ENDPOINT)
        or first >= last then
        return nil, nil
    end

    return first, last
end

local function checked(interval, label)
    local first, last = endpoints(interval)
    if first == nil then
        error("invalid " .. (label or "input") .. " narrative interval", 3)
    end
    return first, last
end

local function interval(first, last)
    return { start = first, ["end"] = last }
end

local function dense_length(values, label)
    if type(values) ~= "table" or getmetatable(values) ~= nil then
        error((label or "input") .. " must be a plain list", 3)
    end

    local count, largest = 0, 0
    for key in pairs(values) do
        if not integer(key, 1, MAX_ENDPOINT) then
            error((label or "input") .. " has invalid list keys", 3)
        end
        count = count + 1
        if key > largest then largest = key end
    end

    if count ~= largest then
        error((label or "input") .. " must be dense", 3)
    end
    return count
end

local function checked_mask(value)
    if not integer(value, 0, FULL_MASK) then
        error("invalid Allen relation mask", 3)
    end
    return value
end

local function includes_bit(mask, index)
    return math.floor(mask / BITS[index]) % 2 == 1
end

local function decimal(value)
    -- Canonicalize negative zero and avoid signed-32-bit %d assumptions.
    if value == 0 then return "0" end
    return string.format("%.0f", value)
end

function M.validate(value)
    local first = endpoints(value)
    return first ~= nil
end

function M.assert_interval(value, label)
    checked(value, label)
    return value
end

function M.is_valid_relation(name)
    return type(name) == "string" and INDEX[name] ~= nil
end

function M.relation_names()
    local result = {}
    for index, name in ipairs(ORDER) do result[index] = name end
    return result
end

function M.converse(name)
    if not M.is_valid_relation(name) then
        error("unknown Allen relation", 2)
    end
    return INVERSE[name]
end

M.inverse = M.converse

function M.relation(a, b)
    local x, X = checked(a, "first")
    local y, Y = checked(b, "second")

    if X < y then return "before" end
    if X == y then return "meets" end
    if x > Y then return "after" end
    if x == Y then return "met_by" end

    if x == y then
        if X == Y then return "equals" end
        return X < Y and "starts" or "started_by"
    end

    if X == Y then
        return x > y and "finishes" or "finished_by"
    end

    if x < y then
        return X < Y and "overlaps" or "contains"
    end

    return X < Y and "during" or "overlapped_by"
end

-- Any positive-duration intersection, not only the Allen "overlaps" atom.
function M.overlaps(a, b)
    local x, X = checked(a, "first")
    local y, Y = checked(b, "second")
    return math.max(x, y) < math.min(X, Y)
end

function M.duration(value)
    local first, last = checked(value)
    return last - first
end

function M.intersection(a, b)
    local x, X = checked(a, "first")
    local y, Y = checked(b, "second")
    local first, last = math.max(x, y), math.min(X, Y)
    if first >= last then return nil end
    return interval(first, last)
end

M.clip = M.intersection

-- Hull fills gaps; it is deliberately not named union.
function M.hull(a, b)
    local x, X = checked(a, "first")
    local y, Y = checked(b, "second")
    return interval(math.min(x, y), math.max(X, Y))
end

-- Inclusive containment: equality also satisfies this predicate.
-- This differs from the strict Allen relation named "contains".
function M.contains(outer, inner)
    local x, X = checked(outer, "outer")
    local y, Y = checked(inner, "inner")
    return x <= y and Y <= X
end

function M.equals(a, b)
    local x, X = checked(a, "first")
    local y, Y = checked(b, "second")
    return x == y and X == Y
end

function M.shift(value, delta)
    local first, last = checked(value)

    if not integer(delta, -MAX_ENDPOINT, MAX_ENDPOINT) then
        error("invalid integer shift", 2)
    end

    -- Check before addition so the calculation stays inside the domain.
    if delta >= 0 then
        if last > MAX_ENDPOINT - delta then
            error("shift exceeds endpoint domain", 2)
        end
    elseif first < -delta then
        error("shift precedes endpoint domain", 2)
    end

    return interval(first + delta, last + delta)
end

function M.is_before_or_meets(a, b)
    local _, X = checked(a, "first")
    local y = checked(b, "second")
    return X <= y
end

function M.is_after_or_met_by(a, b)
    local x = checked(a, "first")
    local _, Y = checked(b, "second")
    return x >= Y
end

function M.disjoint(a, b)
    return not M.overlaps(a, b)
end

function M.touches(a, b)
    local x, X = checked(a, "first")
    local y, Y = checked(b, "second")
    return X == y or Y == x
end

function M.mask(name)
    if not M.is_valid_relation(name) then
        error("unknown Allen relation", 2)
    end
    return BITS[INDEX[name]]
end

function M.unmask(value)
    checked_mask(value)
    local result = {}
    for index, name in ipairs(ORDER) do
        if includes_bit(value, index) then
            result[#result + 1] = name
        end
    end
    return result
end

function M.mask_or(a, b)
    checked_mask(a)
    checked_mask(b)
    local result = 0
    for index = 1, 13 do
        if includes_bit(a, index) or includes_bit(b, index) then
            result = result + BITS[index]
        end
    end
    return result
end

function M.mask_and(a, b)
    checked_mask(a)
    checked_mask(b)
    local result = 0
    for index = 1, 13 do
        if includes_bit(a, index) and includes_bit(b, index) then
            result = result + BITS[index]
        end
    end
    return result
end

-- True iff every relation in b is also present in a.
function M.mask_includes(a, b)
    return M.mask_and(a, b) == b
end

function M.mask_not(value)
    checked_mask(value)
    return FULL_MASK - value
end

function M.mask_converse(value)
    checked_mask(value)
    local result = 0
    for index, name in ipairs(ORDER) do
        if includes_bit(value, index) then
            result = result + M.mask(INVERSE[name])
        end
    end
    return result
end

local function list_mask(values)
    dense_length(values, "relation set")
    local result = 0
    for _, name in ipairs(values) do
        result = M.mask_or(result, M.mask(name))
    end
    return result
end

-- Published table order, distinct from the module's stable mask order.
local SYMBOLS = "pmoFDseSdfOMP"
local SYMBOL_NAME = {
    p = "before", m = "meets", o = "overlaps",
    F = "finished_by", D = "contains", s = "starts",
    e = "equals", S = "started_by", d = "during",
    f = "finishes", O = "overlapped_by",
    M = "met_by", P = "after"
}

local TABLE_ROWS = {
    "p p p p p p p p pmosd pmosd pmosd pmosd full",
    "p p p p p m m m osd osd osd Fef DSOMP",
    "p p pmo pmo pmoFD o o oFD osd osd concur DSO DSOMP",
    "p m o F D o F D osd Fef DSO DSO DSOMP",
    "pmoFD oFD oFD D D oFD D D concur DSO DSO DSO DSOMP",
    "p p pmo pmo pmoFD s s seS d d dfO M P",
    "p m o F D s e S d f O M P",
    "pmoFD oFD oFD D D seS S S dfO O O M P",
    "p p pmosd pmosd full d d dfOMP d d dfOMP P P",
    "p m osd Fef DSOMP d f OMP d f OMP P P",
    "pmoFD oFD concur DSO DSOMP dfO O OMP dfO O OMP P P",
    "pmoFD seS dfO M P dfO M P dfO M P P P",
    "full dfOMP dfOMP P P dfOMP P P dfOMP P P P P"
}

local COMPOSITION = {}

for row_number, row_text in ipairs(TABLE_ROWS) do
    local row_name = SYMBOL_NAME[SYMBOLS:sub(row_number, row_number)]
    local row_index = INDEX[row_name]
    COMPOSITION[row_index] = {}

    local column = 0
    for cell in row_text:gmatch("%S+") do
        column = column + 1
        if cell == "full" then cell = SYMBOLS end
        if cell == "concur" then cell = "oFDseSdfO" end

        local value = 0
        for symbol in cell:gmatch(".") do
            local name = SYMBOL_NAME[symbol]
            assert(name, "invalid composition-table symbol")
            value = M.mask_or(value, M.mask(name))
        end

        assert(value ~= 0, "empty basic composition-table cell")

        local column_name =
            SYMBOL_NAME[SYMBOLS:sub(column, column)]
        assert(column_name, "composition table has too many columns")
        COMPOSITION[row_index][INDEX[column_name]] = value
    end

    assert(column == 13, "composition table must have 13 columns")
end

function M.compose_masks(a, b)
    checked_mask(a)
    checked_mask(b)

    local result = 0
    for i = 1, 13 do
        if includes_bit(a, i) then
            for j = 1, 13 do
                if includes_bit(b, j) then
                    result = M.mask_or(result, COMPOSITION[i][j])
                end
            end
        end
    end
    return result
end

function M.compose(first, second)
    return M.unmask(M.compose_masks(M.mask(first), M.mask(second)))
end

function M.compose_all(first, second)
    return M.unmask(M.compose_masks(list_mask(first), list_mask(second)))
end

-- Convenience alias for two-link inference, not a claim that every atom
-- is itself transitive.
M.transitive = M.compose

function M.relation_set(a, b)
    return { M.relation(a, b) }
end

function M.set_relation(first, second)
    dense_length(first, "first interval set")
    dense_length(second, "second interval set")

    for _, value in ipairs(first) do checked(value, "first-set") end
    for _, value in ipairs(second) do checked(value, "second-set") end

    local result = 0
    for _, a in ipairs(first) do
        for _, b in ipairs(second) do
            result = M.mask_or(result, M.mask(M.relation(a, b)))
        end
    end

    return M.unmask(result)
end

function M.serialize_interval(value)
    local first, last = checked(value)
    return decimal(first) .. ":" .. decimal(last)
end

function M.deserialize_interval(text)
    if type(text) ~= "string" or #text > 40 then
        error("invalid serialized interval", 2)
    end

    local first, last = text:match("^([0-9]+):([0-9]+)$")
    if not first then error("invalid serialized interval", 2) end

    local result = interval(tonumber(first), tonumber(last))
    checked(result)

    if M.serialize_interval(result) ~= text then
        error("noncanonical serialized interval", 2)
    end

    return result
end

-- Canonical endpoint-pair key, not an entity identity or cryptographic hash.
M.fingerprint = M.serialize_interval

function M.split(value, at)
    local first, last = checked(value)

    if not integer(at, 0, MAX_ENDPOINT) then
        error("invalid split endpoint", 2)
    end

    if at <= first or at >= last then return nil end
    return { interval(first, at), interval(at, last) }
end

local function checked_budget(value)
    if not integer(value, 0, 1000000) then
        error("explicit enumeration budget in 0..1000000 required", 3)
    end
    return value
end

function M.enumerate_points(value, budget)
    local first, last = checked(value)
    checked_budget(budget)

    if last - first > budget then
        error("point enumeration budget exceeded", 2)
    end

    local current = first
    return function()
        if current >= last then return nil end
        local result = current
        current = current + 1
        return result
    end
end

-- All nonempty intervals with endpoints in inclusive [low, high].
function M.enumerate_range(low, high, budget)
    if not integer(low, 0, MAX_ENDPOINT)
        or not integer(high, 0, MAX_ENDPOINT)
        or low > high then
        error("invalid endpoint range", 2)
    end

    checked_budget(budget)

    local width = high - low

    -- Early check keeps the subsequent count calculation small and exact.
    if width > budget then
        error("interval enumeration budget exceeded", 2)
    end

    local count = width * (width + 1) / 2
    if count > budget then
        error("interval enumeration budget exceeded", 2)
    end

    local first, last = low, low + 1
    return function()
        if first >= high then return nil end

        local result = interval(first, last)
        if last < high then
            last = last + 1
        else
            first = first + 1
            if first < high then last = first + 1 end
        end

        return result
    end
end

function M.self_test()
    local function expect_error(callback)
        assert(not pcall(callback), "expected error")
    end

    local function same_names(actual, expected)
        assert(#actual == #expected, "relation-set size mismatch")
        for index, name in ipairs(expected) do
            assert(actual[index] == name, "relation-set member mismatch")
        end
    end

    local witnesses = {
        { "before",        0, 1, 2, 3 },
        { "meets",         0, 1, 1, 2 },
        { "overlaps",      0, 2, 1, 3 },
        { "starts",        0, 1, 0, 2 },
        { "during",        1, 2, 0, 3 },
        { "finishes",      1, 3, 0, 3 },
        { "equals",        0, 2, 0, 2 },
        { "after",         2, 3, 0, 1 },
        { "met_by",        1, 2, 0, 1 },
        { "overlapped_by", 1, 3, 0, 2 },
        { "started_by",    0, 2, 0, 1 },
        { "contains",      0, 3, 1, 2 },
        { "finished_by",   0, 3, 1, 3 }
    }

    for _, w in ipairs(witnesses) do
        assert(M.relation(interval(w[2], w[3]), interval(w[4], w[5]))
            == w[1], "relation witness failed")
    end

    local small = {}
    for value in M.enumerate_range(0, 4, 10) do
        small[#small + 1] = value
    end

    local pair_count, seen = 0, {}
    for _, a in ipairs(small) do
        for _, b in ipairs(small) do
            local relation = M.relation(a, b)
            assert(M.relation(b, a) == M.converse(relation))
            assert(M.overlaps(a, b) == M.overlaps(b, a))
            assert(M.overlaps(a, b) == (
                relation ~= "before" and relation ~= "after"
                and relation ~= "meets" and relation ~= "met_by"
            ))
            seen[relation] = true
            pair_count = pair_count + 1
        end
    end
    assert(pair_count == 100)

    local seen_count = 0
    for _ in pairs(seen) do seen_count = seen_count + 1 end
    assert(seen_count == 13)

    for _, name in ipairs(ORDER) do
        same_names(M.compose("equals", name), {name})
        same_names(M.compose(name, "equals"), {name})
        assert(M.converse(M.converse(name)) == name)
    end

    same_names(M.compose("before", "before"), {"before"})
    same_names(M.compose("meets", "meets"), {"before"})
    same_names(M.compose("before", "overlaps"), {"before"})
    same_names(M.compose("overlaps", "overlaps"),
        {"before", "meets", "overlaps"})

    assert(M.compose_masks(0, FULL_MASK) == 0)
    assert(M.compose_masks(FULL_MASK, 0) == 0)

    for value = 0, FULL_MASK do
        assert(list_mask(M.unmask(value)) == value)
        assert(M.mask_and(value, FULL_MASK) == value)
        assert(M.mask_or(value, 0) == value)
        assert(M.mask_converse(M.mask_converse(value)) == value)
    end

    -- Re-derive every table cell from all weak endpoint orderings.
    -- Three intervals have at most six distinct endpoints; rank
    -- compression places every ordering in the universe 0..5.
    local universe = {}
    for value in M.enumerate_range(0, 5, 15) do
        universe[#universe + 1] = value
    end

    local derived = {}
    for i = 1, 13 do
        derived[i] = {}
        for j = 1, 13 do derived[i][j] = 0 end
    end

    local triples = 0
    for _, a in ipairs(universe) do
        for _, b in ipairs(universe) do
            local i = INDEX[M.relation(a, b)]
            for _, c in ipairs(universe) do
                local j = INDEX[M.relation(b, c)]
                derived[i][j] = M.mask_or(
                    derived[i][j],
                    M.mask(M.relation(a, c))
                )
                triples = triples + 1
            end
        end
    end

    for i = 1, 13 do
        for j = 1, 13 do
            assert(derived[i][j] == COMPOSITION[i][j],
                "composition-table derivation mismatch")
        end
    end
    assert(triples == 3375)

    assert(M.duration(interval(2, 5)) == 3)
    assert(M.equals(
        M.intersection(interval(0, 3), interval(2, 4)),
        interval(2, 3)
    ))
    assert(M.intersection(interval(0, 2), interval(2, 4)) == nil)
    assert(M.equals(
        M.hull(interval(0, 1), interval(3, 4)),
        interval(0, 4)
    ))
    assert(M.contains(interval(0, 4), interval(1, 2)))
    assert(M.contains(interval(0, 4), interval(0, 4)))
    assert(M.equals(M.shift(interval(2, 4), -2), interval(0, 2)))
    assert(M.touches(interval(0, 2), interval(2, 3)))
    assert(M.disjoint(interval(0, 2), interval(2, 3)))

    local pieces = M.split(interval(0, 4), 2)
    assert(M.equals(pieces[1], interval(0, 2)))
    assert(M.equals(pieces[2], interval(2, 4)))
    assert(M.split(interval(0, 4), 0) == nil)

    local points = {}
    for point in M.enumerate_points(interval(2, 5), 3) do
        points[#points + 1] = point
    end
    assert(#points == 3 and points[1] == 2 and points[3] == 4)

    local edge = interval(MAX_ENDPOINT - 1, MAX_ENDPOINT)
    assert(M.equals(
        M.deserialize_interval(M.serialize_interval(edge)),
        edge
    ))
    assert(M.serialize_interval(interval(0, 2)) == "0:2")

    assert(not M.validate(interval(-1, 1)))
    assert(not M.validate(interval(1, 1)))
    assert(not M.validate(interval(0.5, 2)))
    assert(not M.validate(nil))
    assert(not M.validate(setmetatable({}, {
        __index = {start = 0, ["end"] = 1}
    })))

    expect_error(function() M.compose("unknown", "before") end)
    expect_error(function() M.unmask(8192) end)
    expect_error(function() M.shift(edge, 1) end)
    expect_error(function() M.shift(interval(0, 1), -1) end)
    expect_error(function() M.deserialize_interval("00:2") end)
    expect_error(function() M.enumerate_points(interval(0, 4), 3) end)
    expect_error(function() M.enumerate_range(0, 5, 14) end)

    return {
        status = "passed",
        relation_witnesses = 13,
        interval_pairs = 100,
        composition_cells = 169,
        composition_triples = triples,
        mask_roundtrips = 8192
    }
end

return M
