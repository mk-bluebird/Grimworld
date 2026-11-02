-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: none.
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}
local MAX_ENDPOINT = 9007199254740991

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

local function valid_endpoint(value)
    return type(value) == "number"
        and value >= 0
        and value <= MAX_ENDPOINT
        and value == math.floor(value)
end

local function endpoints(interval)
    if type(interval) ~= "table" then
        return nil, nil
    end

    local first = rawget(interval, "start")
    local last = rawget(interval, "end")

    if not valid_endpoint(first)
        or not valid_endpoint(last)
        or first >= last then
        return nil, nil
    end

    return first, last
end

local function checked_endpoints(interval, position)
    local first, last = endpoints(interval)

    if first == nil then
        error("invalid " .. position .. " narrative interval", 3)
    end

    return first, last
end

function M.validate(interval)
    local first = endpoints(interval)
    return first ~= nil
end

function M.inverse(relation)
    if type(relation) ~= "string" or INVERSE[relation] == nil then
        error("unknown Allen relation", 2)
    end

    return INVERSE[relation]
end

function M.relation(a, b)
    local a_start, a_end = checked_endpoints(a, "first")
    local b_start, b_end = checked_endpoints(b, "second")

    if a_end < b_start then
        return "before"
    end

    if a_end == b_start then
        return "meets"
    end

    if a_start > b_end then
        return "after"
    end

    if a_start == b_end then
        return "met_by"
    end

    if a_start == b_start then
        if a_end == b_end then
            return "equals"
        end

        return a_end < b_end and "starts" or "started_by"
    end

    if a_end == b_end then
        return a_start > b_start and "finishes" or "finished_by"
    end

    if a_start < b_start then
        return a_end < b_end and "overlaps" or "contains"
    end

    return a_end < b_end and "during" or "overlapped_by"
end

-- Positive-duration intersection; meeting endpoints do not overlap.
function M.overlaps(a, b)
    local a_start, a_end = checked_endpoints(a, "first")
    local b_start, b_end = checked_endpoints(b, "second")

    return math.max(a_start, b_start) < math.min(a_end, b_end)
end

function M.self_test()
    local function interval(first, last)
        return { start = first, ["end"] = last }
    end

    local function expect_error(callback)
        local ok = pcall(callback)
        assert(not ok, "expected an error")
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

    for _, witness in ipairs(witnesses) do
        local a = interval(witness[2], witness[3])
        local b = interval(witness[4], witness[5])

        assert(M.relation(a, b) == witness[1],
            "relation witness failed: " .. witness[1])
    end

    local intervals = {}

    for first = 0, 3 do
        for last = first + 1, 4 do
            intervals[#intervals + 1] = interval(first, last)
        end
    end

    local pairs_checked = 0
    local seen = {}

    for _, a in ipairs(intervals) do
        for _, b in ipairs(intervals) do
            local relation = M.relation(a, b)

            assert(M.relation(b, a) == M.inverse(relation),
                "converse symmetry failed")
            assert(M.inverse(M.inverse(relation)) == relation,
                "inverse involution failed")
            assert(M.overlaps(a, b) == M.overlaps(b, a),
                "intersection symmetry failed")

            local expected_overlap =
                relation ~= "before"
                and relation ~= "after"
                and relation ~= "meets"
                and relation ~= "met_by"

            assert(M.overlaps(a, b) == expected_overlap,
                "relation/intersection agreement failed")

            seen[relation] = true
            pairs_checked = pairs_checked + 1
        end
    end

    local relations_checked = 0

    for _ in pairs(seen) do
        relations_checked = relations_checked + 1
    end

    assert(pairs_checked == 100, "unexpected interval-pair count")
    assert(relations_checked == 13, "not all relations exercised")

    assert(M.overlaps(interval(0, 3), interval(2, 4)))
    assert(not M.overlaps(interval(0, 2), interval(2, 4)))
    assert(M.overlaps(interval(0, 4), interval(1, 2)))

    assert(M.validate(interval(MAX_ENDPOINT - 1, MAX_ENDPOINT)))
    assert(not M.validate(interval(-1, 1)))
    assert(not M.validate(interval(1, 1)))
    assert(not M.validate(interval(2, 1)))
    assert(not M.validate(interval(0.5, 2)))
    assert(not M.validate(interval(0, math.huge)))
    assert(not M.validate(interval(0, MAX_ENDPOINT + 1)))
    assert(not M.validate({ start = 0 }))
    assert(not M.validate(nil))
    assert(not M.validate("interval"))

    local nan = math.huge - math.huge
    assert(not M.validate(interval(nan, 2)))

    local inherited = setmetatable({}, {
        __index = { start = 0, ["end"] = 1 }
    })
    assert(not M.validate(inherited),
        "interval endpoints must be explicit fields")

    expect_error(function()
        M.relation(interval(1, 1), interval(0, 2))
    end)

    expect_error(function()
        M.overlaps(interval(0, 2), nil)
    end)

    expect_error(function()
        M.inverse("unknown")
    end)

    return {
        status = "passed",
        relation_witnesses = #witnesses,
        interval_pairs = pairs_checked,
        relations_exercised = relations_checked
    }
end

return M
