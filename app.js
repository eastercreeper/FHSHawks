
const SUPABASE_URL = "https://qfqecwwznhszayajaaxy.supabase.co";
const SUPABASE_KEY = "sb_publishable_JR5pfYslvh1a4BQya8eibQ_426Y5Pc-";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Get the current logged-in user.
async function getCurrentUser() {
    const { data, error } = await db.auth.getUser();

    if (error) {
        return null;
    }

    return data.user;
}

// Check whether the logged-in user is an authorized admin.
// The database, not this function, enforces permissions.
async function isAdmin() {
    const user = await getCurrentUser();

    if (!user) return false;

    const { data, error } = await db
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    return !error && !!data;
}

// Sign in with an existing Supabase account.
async function signIn(email, password) {
    const { data, error } = await db.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;

    return data.user;
}

// Sign out.
async function signOut() {
    const { error } = await db.auth.signOut();

    if (error) throw error;

    window.location.href = "index.html";
}

// Load the public roster.
async function loadPlayers() {
    const { data, error } = await db
        .from("players")
        .select("id, player_number, player_name")
        .order("player_number");

    if (error) throw error;

    return data;
}

// Save a player's name or number.
// Supabase will reject unauthorized changes.
async function savePlayer(player) {
    const payload = {
        player_number: Number(player.player_number),
        player_name: player.player_name.trim()
    };

    if (
        !Number.isInteger(payload.player_number) ||
        payload.player_number < 0 ||
        !payload.player_name
    ) {
        throw new Error("Enter a valid player number and name.");
    }

    let request = db.from("players");

    if (player.id) {
        request = request
            .update(payload)
            .eq("id", player.id);
    } else {
        request = request.insert(payload);
    }

    const { error } = await request;

    if (error) throw error;
}

// Delete a player.
async function deletePlayer(id) {
    const { error } = await db
        .from("players")
        .delete()
        .eq("id", id);

    if (error) throw error;
}

// Load saved lineups.
async function loadLineups() {
    const { data, error } = await db
        .from("lineups")
        .select("id, name, created_at, updated_at")
        .order("name");

    if (error) throw error;

    return data;
}

// Save a new lineup.
async function createLineup(name) {
    const cleanName = name.trim();

    if (!cleanName) {
        throw new Error("Enter a lineup name.");
    }

    const { data, error } = await db
        .from("lineups")
        .insert({ name: cleanName })
        .select()
        .single();

    if (error) throw error;

    return data;
}

// Load the players assigned to a lineup.
async function loadLineupPlayers(lineupId) {
    const { data, error } = await db
        .from("lineup_players")
        .select("player_id, players(id, player_number, player_name)")
        .eq("lineup_id", lineupId);

    if (error) throw error;

    return data.map(row => row.players).filter(Boolean);
}

// Replace a lineup's player assignments.
async function saveLineupPlayers(lineupId, playerIds) {
    if (!(await isAdmin())) {
        throw new Error("Administrator access required.");
    }

    const { error: deleteError } = await db
        .from("lineup_players")
        .delete()
        .eq("lineup_id", lineupId);

    if (deleteError) throw deleteError;

    if (playerIds.length === 0) return;

    const rows = [...new Set(playerIds)].map(playerId => ({
        lineup_id: lineupId,
        player_id: playerId
    }));

    const { error: insertError } = await db
        .from("lineup_players")
        .insert(rows);

    if (insertError) throw insertError;
}
