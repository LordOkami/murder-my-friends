const { onValueCreated, onValueDeleted } = require("firebase-functions/v2/database");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({ region: "europe-west1" });

const DB_INSTANCE = "murder-my-friends-default-rtdb";

/**
 * When a pending kill is created, notify the victim via push.
 */
exports.onPendingKillCreated = onValueCreated(
    { ref: "games/{gameCode}/pendingKills/{victimId}", instance: DB_INSTANCE },
    async (event) => {
        const victimId = event.params.victimId;
        const data = event.data.val();
        const killerName = data.killerName || "Alguien";
        const gameCode = event.params.gameCode;

        const message = {
            notification: {
                title: "Te han eliminado",
                body: `${killerName} dice que te ha eliminado`,
            },
            data: {
                type: "pendingKill",
                gameCode: gameCode,
            },
            webpush: {
                fcmOptions: {
                    link: "https://murdermyfriends.netlify.app/",
                },
            },
        };

        await sendToUser(victimId, message);
    }
);

/**
 * When a pending kill is deleted, notify the killer of the result.
 * - If victim is in killedPlayers → accepted (send new target info)
 * - If victim is NOT in killedPlayers → rejected
 */
exports.onPendingKillDeleted = onValueDeleted(
    { ref: "games/{gameCode}/pendingKills/{victimId}", instance: DB_INSTANCE },
    async (event) => {
        const victimId = event.params.victimId;
        const gameCode = event.params.gameCode;
        const previousData = event.data.val();
        const killerId = previousData.killerId;

        if (!killerId) return;

        // Read current game state
        const gameSnap = await admin.database().ref(`games/${gameCode}`).once("value");
        const gameData = gameSnap.val();
        if (!gameData) return;

        const killedPlayers = gameData.killedPlayers || [];
        const wasAccepted = killedPlayers.includes(victimId);

        if (!wasAccepted) {
            // Rejected
            await sendToUser(killerId, {
                notification: {
                    title: "Asesinato rechazado",
                    body: "Tu objetivo ha rechazado el asesinato",
                },
                data: { type: "killRejected", gameCode },
                webpush: {
                    fcmOptions: {
                        link: "https://murdermyfriends.netlify.app/",
                    },
                },
            });
        } else {
            // Accepted — calculate new target
            const newTargetId = getTargetForKiller(gameData, killerId);
            let newTargetName = "???";

            if (newTargetId && gameData.players && gameData.players[newTargetId]) {
                newTargetName = gameData.players[newTargetId].name || "???";
            }

            await sendToUser(killerId, {
                notification: {
                    title: "Nueva mision",
                    body: `Tu nuevo objetivo es ${newTargetName}`,
                },
                data: { type: "newTarget", gameCode },
                webpush: {
                    fcmOptions: {
                        link: "https://murdermyfriends.netlify.app/",
                    },
                },
            });
        }
    }
);

/**
 * Replicate the client-side target inheritance logic.
 * Follows the assignment chain through killed players to find the current live target.
 */
function getTargetForKiller(gameData, killerId) {
    const assignments = gameData.assignments || {};
    const assignment = assignments[killerId];
    if (!assignment) return null;

    let targetId = assignment.targetId;
    const killedPlayers = gameData.killedPlayers || [];
    const visited = new Set([killerId]);

    while (killedPlayers.includes(targetId) && !visited.has(targetId)) {
        visited.add(targetId);
        const nextAssignment = assignments[targetId];
        if (nextAssignment) {
            targetId = nextAssignment.targetId;
        } else {
            break;
        }
    }

    return targetId;
}

/**
 * Send a push notification to all devices of a given user.
 * Cleans up invalid tokens automatically.
 */
async function sendToUser(uid, message) {
    const tokensSnap = await admin.database().ref(`users/${uid}/fcmTokens`).once("value");
    const tokensData = tokensSnap.val();
    if (!tokensData) return;

    const tokens = [];
    const tokenKeys = [];

    for (const [key, entry] of Object.entries(tokensData)) {
        if (entry && entry.token) {
            tokens.push(entry.token);
            tokenKeys.push(key);
        }
    }

    if (tokens.length === 0) return;

    const response = await admin.messaging().sendEachForMulticast({
        tokens,
        ...message,
    });

    // Clean up invalid tokens
    const tokensToRemove = [];
    response.responses.forEach((resp, idx) => {
        if (!resp.success) {
            const code = resp.error?.code;
            if (
                code === "messaging/invalid-registration-token" ||
                code === "messaging/registration-token-not-registered"
            ) {
                tokensToRemove.push(tokenKeys[idx]);
            }
        }
    });

    if (tokensToRemove.length > 0) {
        const updates = {};
        tokensToRemove.forEach((key) => {
            updates[key] = null;
        });
        await admin.database().ref(`users/${uid}/fcmTokens`).update(updates);
    }
}
