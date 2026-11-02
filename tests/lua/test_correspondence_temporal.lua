-- RUNTIME: standard Lua 5.1 / Lua 5.4.
-- Luau requires only host-specific module-loading/output adapters.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local C = require("lua.correspondence")
local Allen = require("lua.allen")
local Conflicts = require("lua.conflict_sweep").new(Allen)
local RNG = require("lua.rng")

-- Registry-interface test double.
-- Real registry admission is tested separately through scene_loader.
local records = {}
local registry = {
    read = function(handle)
        assert(records[handle], "foreign handle")
        return records[handle]
    end
}
local function entity(attributes)
    local handle = {}
    records[handle] = { attributes = attributes }
    return handle
end

local near = entity({
    architecture = "paired_village_architecture",
    alignment = "near_reference"
})
local far = entity({
    architecture = "paired_village_architecture",
    alignment = "sideways_displaced"
})

assert(C.corresponds(registry, near, far, {
    scope = "listed_attributes",
    preserve = {"architecture"},
    alter = {{
        key = "alignment", operation = "replace",
        from = "near_reference", to = "sideways_displaced"
    }},
    exceptions = {}
}).status == "satisfied")

local widow = entity({
    coat = "paired_coat_motif",
    head = "shared_unspecified_angle",
    repair = "source_side",
    lantern = "lit",
    held = "key"
})
local counterpart = entity({
    coat = "paired_coat_motif",
    head = "shared_unspecified_angle",
    repair = "opposite_source_side",
    lantern = "unlit",
    held = "open_lock"
})

local rule = {
    scope = "listed_attributes",
    preserve = {"coat", "head"},
    alter = {
        {key="repair", operation="mirror",
            from="source_side", to="opposite_source_side"},
        {key="lantern", operation="replace", from="lit", to="unlit"},
        {key="held", operation="replace", from="key", to="open_lock"}
    },
    mirror_axis = "character_sagittal",
    exceptions = {}
}

assert(C.corresponds(registry, widow, counterpart, rule).status == "satisfied")

local naive = entity({
    coat = "paired_coat_motif",
    head = "shared_unspecified_angle",
    repair = "opposite_source_side",
    lantern = "lit",
    held = "key"
})
local failed = C.corresponds(registry, widow, naive, rule)
assert(failed.status == "violated")
local alteration_failures = 0
for _, finding in ipairs(failed.findings) do
    if finding.code == "ALTER_MISMATCH" then
        alteration_failures = alteration_failures + 1
    end
end
assert(alteration_failures == 2)

-- Independent endpoint predicates: exactly one must hold.
local function oracle(a, b)
    local x, X, y, Y = a.start, a["end"], b.start, b["end"]
    local tests = {
        before = X < y,
        meets = X == y,
        overlaps = x < y and y < X and X < Y,
        starts = x == y and X < Y,
        during = y < x and X < Y,
        finishes = y < x and X == Y,
        equals = x == y and X == Y,
        after = Y < x,
        met_by = Y == x,
        overlapped_by = y < x and x < Y and Y < X,
        started_by = x == y and Y < X,
        contains = x < y and Y < X,
        finished_by = x < y and X == Y
    }
    local count, result = 0, nil
    for name, holds in pairs(tests) do
        if holds then count = count + 1; result = name end
    end
    assert(count == 1)
    return result
end

local intervals, seen, pairs_checked = {}, {}, 0
for first = 0, 3 do
    for last = first + 1, 4 do
        intervals[#intervals + 1] = {start=first, ["end"]=last}
    end
end

for _, a in ipairs(intervals) do
    for _, b in ipairs(intervals) do
        local relation = Allen.relation(a, b)
        assert(relation == oracle(a, b))
        assert(Allen.relation(b, a) == Allen.inverse(relation))
        seen[relation] = true
        pairs_checked = pairs_checked + 1
    end
end

local relation_count = 0
for _ in pairs(seen) do relation_count = relation_count + 1 end
assert(pairs_checked == 100 and relation_count == 13)

assert(not Allen.validate({start=-1, ["end"]=1}))
assert(not Allen.validate({start=1, ["end"]=1}))
assert(not Allen.overlaps({start=0, ["end"]=1}, {start=1, ["end"]=2}))

local function assertion(id, value, world)
    return {
        id=id, world=world or "living",
        subject="widow", predicate="lantern_state",
        value=value, epistemic="canon", cardinality="single",
        start=0, ["end"]=3
    }
end

local function compare(rows)
    local prepared = Conflicts.prepare(rows)
    assert(prepared.status == "accepted")
    local a = Conflicts.pairwise(prepared.token)
    local b = Conflicts.sweep(prepared.token)
    assert(a.status == "complete" and b.status == "complete")
    assert(#a.conflicts == #b.conflicts)

    for i = 1, #a.conflicts do
        assert(a.conflicts[i][1] == b.conflicts[i][1])
        assert(a.conflicts[i][2] == b.conflicts[i][2])
    end
    return b
end

assert(#compare({
    assertion("a", "lit", "living"),
    assertion("b", "unlit", "parallel")
}).conflicts == 0)

local multiple = assertion("b", "unlit")
multiple.cardinality = "multiple"
assert(#compare({assertion("a", "lit"), multiple}).conflicts == 0)

local random = RNG.new(391)
for corpus = 1, 300 do
    local rows = {}
    for i = 1, 30 do
        local row = assertion("a" .. i,
            random.integer(0, 1) == 0 and "lit" or "unlit",
            random.integer(0, 1) == 0 and "living" or "parallel")
        row.start = random.integer(0, 20)
        row["end"] = row.start + random.integer(1, 10)
        row.subject = random.integer(0, 1) == 0 and "widow" or "counterpart"
        if random.integer(1, 5) == 1 then row.epistemic = "belief" end
        if random.integer(1, 10) == 1 then row.cardinality = "multiple" end
        rows[#rows + 1] = row
    end
    compare(rows)
end

local prepared = Conflicts.prepare({
    assertion("a", "lit"), assertion("b", "unlit")
})
assert(prepared.status == "accepted")
assert(Conflicts.sweep(prepared.token, {maxConflicts=0}).status ==
    "conflict_limit_exceeded")

io.write("allen_pairs=100 relations=13 generated_corpora=300\n")
