// api/chat.js — Vercel Serverless Function
// Cette fonction tourne côté serveur — la clé API n'est JAMAIS exposée au navigateur

export default async function handler(req, res) {
  // Sécurité : seulement les requêtes POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Sécurité : vérifier que la requête vient de ton domaine
  const origin = req.headers.origin || "";
  const allowed = [
    "https://creatorai.vercel.app",     // ton domaine Vercel (à mettre à jour)
    "http://localhost:3000",             // développement local
  ];
  // En production, décommente ces lignes pour bloquer les autres origines :
  // if (!allowed.some(a => origin.startsWith(a))) {
  //   return res.status(403).json({ error: "Forbidden" });
  // }

  try {
    const { system, messages, max_tokens } = req.body;

    // Validation basique
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "messages requis" });
    }

    // Appel à l'API Anthropic — la clé est dans les variables d'environnement Vercel
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,  // 🔒 clé cachée côté serveur
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: max_tokens || 2000,
        system: system || "",
        messages,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    // Retourne seulement le texte — pas d'info sensible
    return res.status(200).json({ text: data.content[0].text });

  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
}
