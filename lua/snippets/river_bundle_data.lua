-- RUNTIME: Lua 5.1 / Lua 5.4 / Luau common subset.
-- DEPENDENCIES: none.
--
-- SOVEREIGN-ATTRIBUTION
-- bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
-- Credit/metadata only; not identity, consent, authorization, or execution.

local M = {}

M.attribution =
    "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7"

M.creative_addition = {
    claim_id = "choice-inspect",
    origin = "creative_addition",
    basis = "implementation_choice",
    scene_anchors = {
        "entity:widow",
        "entity:far_doorway"
    },
    note =
        "Invented action inspired by the threshold composition; " ..
        "not a supplied event."
}

M.custom = {
    id = "clay_house_river_custom",
    kind = "ritual_practice",

    authenticity = {
        vocabulary = "grimlore.authenticity.v1",
        status = "fictional",
        label = "Fictional custom created for Grimlore."
    },

    -- Acquisition context and support within that source are separate.
    source_kind = "user_supplied_description",
    basis = "explicit_description",

    purpose = {
        state = "intentionally_open",
        reason =
            "Preserve the custom's unexplained purpose in this adaptation.",
        basis = "implementation_choice"
    },

    narrative_policy = {
        protected_topics = { "purpose" },
        allow_attributed_speculation = true,
        allow_resolution = false
    }
}

M.prohibited_explanation_fixture = {
    id = "invented-explanation",
    subject = "clay_house_river_custom",
    topic = "purpose",
    text = "The wax seals imprison the souls of drowned villagers.",
    treatment = "authoritative_resolution"
}

M.placement_preset = {
    seed = 1,
    count = 8,
    spacing = 24,
    jitter = 2,
    width = 12,
    origin_x = 0,
    origin_y = 0
}

M.park_miller_reference = {
    algorithm = "park-miller-16807-v1",
    seed = 1,
    first_five = {
        16807,
        282475249,
        1622650073,
        984943658,
        1144108930
    },
    state_after_10000 = 1043618065
}

M.reported_prior_evidence = {
    provenance = "supplied_session_record",
    attribution = M.attribution,
    executed =
        "Python direct modular recurrence and reference serialization; " ..
        "Python harness syntax compilation",
    lua_execution = "not performed",

    schrage_product_a = 2147464004,
    schrage_product_r = 47661816,
    product_sum = 2195125820,

    -- This identifies the previously specified 1022-byte artifact.
    -- It is NOT the hash of arbitrary output from this bundle.
    fixture_sha256 =
        "8a80572fe6a675b229e89aeb5a1a4fcdfe6adfa0f07ae7f87fc29be433862fc2",
    fixture_bytes = 1022,

    jitter_reference = {
        seed = 1,
        pairs = 10000,
        offsets = { -2, 2 },
        initial_draw = "integer(1,8)",
        occupied_bins = 25,
        bins = 25,
        minimum_count = 364,
        maximum_count = 444,
        claim =
            "Descriptive bin counts only; not evidence of independent " ..
            "samples, visual acceptability, or absence of spectral structure."
    }
}

M.characters = {
    widow = {
        head_inclination = "paired_unspecified_angle",
        coat_motif = "widow_coat",
        shoulder_repair = "source_side",
        lantern_state = "lit",
        held_object = "house_key"
    },
    counterpart = {
        head_inclination = "paired_unspecified_angle",
        coat_motif = "widow_coat",
        shoulder_repair = "opposite_source_side",
        lantern_state = "unlit",
        held_object = "open_lock"
    }
}

M.character_correspondence = {
    scope = "listed_attributes",
    preserve = { "coat_motif", "head_inclination" },
    alter = {
        {
            key = "shoulder_repair",
            operation = "mirror",
            from = "source_side",
            to = "opposite_source_side"
        },
        {
            key = "lantern_state",
            operation = "replace",
            from = "lit",
            to = "unlit"
        },
        {
            key = "held_object",
            operation = "replace",
            from = "house_key",
            to = "open_lock"
        }
    },
    mirror_axis = "character_sagittal",
    exceptions = {}
}

M.villages = {
    near = {
        architecture = {
            bell_tower = "paired_bell_tower",
            mill = "paired_mill",
            houses = "paired_steep_gabled_cluster"
        },
        street_alignment = "near_bank_reference",
        tower = {
            lean = "toward_river",
            bell = "absent_from_belfry"
        }
    },
    far = {
        architecture = {
            bell_tower = "paired_bell_tower",
            mill = "paired_mill",
            houses = "paired_steep_gabled_cluster"
        },
        street_alignment = "laterally_displaced",
        tower = {
            lean = "straight",
            bell = "outside_tower_without_visible_support"
        }
    }
}

M.expected_village_changes = {
    "/street_alignment",
    "/tower/bell",
    "/tower/lean"
}

M.source_reflection = {
    depicted_pose_relation = {
        owner = "hesitating_before_step",
        reflection = "already_stepped_forward",
        basis = "explicit_description"
    },
    action_lead = {
        state = "unknown",
        reason =
            "The source supplies no measured lead time or established " ..
            "action sequence."
    }
}

M.authored_reflection_alternative = {
    profile = "grimlore.reflection-lead.v1",
    interpretation = "reflection_action_precedes_owner_action",
    lead = {
        value = 3,
        unit = "narrative_tick"
    },
    basis = "implementation_choice",
    origin = "creative_addition"
}

M.spatial_description = {
    depth = "far",
    apparent_size = "large",
    measurement = "unspecified"
}

M.far_bell_policy = {
    reference_kind = "visual_relation_not_attachment",
    relation = "outside_tower",
    posture = "hanging",
    support_visibility = "not_visible",
    physical_support = "unestablished"
}

M.motion_policies = {
    laundry = "always_frozen",
    leaves = "advance_during_enabled_intervals_only"
}

M.citation_nodes = {
    {
        ref = "relationship:invitation_reading",
        basis = "derived_interpretation",
        supports = {
            "entity:widow",
            "entity:far_doorway"
        }
    }
}

M.support_sidecar = {
    ["relationship:invitation_reading"] = {
        "entity:widow",
        "entity:far_doorway"
    }
}

M.projection_profile = {
    id = "grimlore.character-stable-fields",
    revision = "1",
    fields = {
        "/kind",
        "/realm",
        "/attributes/coat_motif"
    }
}

M.variant = {
    variant_id = "widow-crosses",
    revision = 1,
    derived_from = {
        { variant_id = "original", revision = 3 }
    }
}

M.localization = {
    language = "fr",
    direction = "ltr",
    text =
        "Une veuve tient une lanterne devant un village situé " ..
        "de l’autre côté du fleuve.",
    review_status = "pending"
}

return M
