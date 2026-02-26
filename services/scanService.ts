import { Pepite } from '@/types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

const UNSPLASH_IMAGES: Record<string, string> = {
  watch: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&h=600&fit=crop',
  handbag: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&fit=crop',
  sneakers: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=600&fit=crop',
  camera: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=600&fit=crop',
  vintage: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=600&fit=crop',
  electronics: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=600&fit=crop',
  jewelry: 'https://images.unsplash.com/photo-1515562141589-67f0d569b6c2?w=600&h=600&fit=crop',
  furniture: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop',
  art: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=600&fit=crop',
  gaming: 'https://images.unsplash.com/photo-1486401899868-0e435ed85128?w=600&h=600&fit=crop',
  vinyl: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=600&h=600&fit=crop',
  clothing: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
  shoes: 'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=600&h=600&fit=crop',
  bike: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&h=600&fit=crop',
  book: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=600&fit=crop',
  bag: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&fit=crop',
  console: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=600&h=600&fit=crop',
  phone: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop',
  laptop: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&h=600&fit=crop',
  default: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&h=600&fit=crop',
};

function getImageForQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  for (const [key, url] of Object.entries(UNSPLASH_IMAGES)) {
    if (lowerQuery.includes(key)) {
      return url;
    }
  }
  const keys = Object.keys(UNSPLASH_IMAGES).filter(k => k !== 'default');
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return UNSPLASH_IMAGES[randomKey] ?? UNSPLASH_IMAGES.default;
}

interface GeminiPepite {
  title: string;
  sellerPrice: number;
  estimatedValue: number;
  profit: number;
  source: string;
  sourceUrl: string;
  category: string;
  description: string;
  imageKeyword: string;
  adUrl: string;
  adImageUrl: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
  };
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

function buildVideoExpertPrompt(merchantName: string, pageContent: string, frameCount: number): string {
  return `Tu es un EXPERT en achat-revente et flipping depuis 15 ans. Tu connais parfaitement les cotes du marché de l'occasion en France.

TON EXPERTISE :
- Tu maîtrises les prix du marché de revente pour : montres de luxe, sneakers limitées, sacs de marque, électronique, consoles retro, vinyles, mobilier design, art, bijoux, vêtements de marque
- Tu sais identifier les annonces sous-évaluées en quelques secondes
- Tu connais les techniques de revente (eBay, Vinted, Vestiaire Collective, marchés spécialisés)
- Tu calcules le profit NET réaliste (après frais de plateforme ~10-15%, envoi ~5-10€)

CONTEXTE DU SCAN VIDÉO :
L'utilisateur a scanné "${merchantName}" pendant 30 secondes. Tu reçois ${frameCount} captures d'écran prises pendant sa navigation, comme des frames d'une vidéo de son écran.
${pageContent ? `\nDonnées textuelles extraites en complément :\n---\n${pageContent.substring(0, 6000)}\n---` : ''}

MISSION :
Analyse CHAQUE image/frame attentivement. Regarde les annonces visibles : titres, prix, photos des produits, descriptions.
Identifie les VRAIES bonnes affaires visibles dans ces captures.
Si tu vois des annonces réelles avec des prix, analyse-les. Sinon, base-toi sur le type de produits typiquement vendus sur ${merchantName}.

CRITÈRES DE SÉLECTION D'UNE PÉPITE :
1. Le prix demandé est au minimum 30% en dessous de la valeur marché
2. Le produit a une demande forte et se revend facilement
3. Le profit potentiel justifie l'effort (minimum 40€ de profit)
4. L'état du produit est acceptable pour la revente

IMPORTANT : Sois réaliste dans tes estimations. Pas de profits fantaisistes.
- Un iPhone d'occasion se revend sur certaines plateformes avec 15-20% de marge max
- Une montre de luxe vintage peut avoir 50-200% de marge si bien sourcée
- Des sneakers limitées neuves peuvent avoir 30-100% de marge
- Du mobilier design vintage peut avoir 100-500% de marge

IMPORTANT : Si tu vois des URLs d'annonces ou des images de produits dans les captures, INCLUS-LES dans ta réponse (champs adUrl et adImageUrl).

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backticks, dans ce format exact :
{
  "pepites": [
    {
      "title": "Nom précis du produit (marque, modèle, taille/ref si pertinent)",
      "sellerPrice": 0,
      "estimatedValue": 0,
      "profit": 0,
      "source": "${merchantName}",
      "sourceUrl": "URL réelle ou plausible de l'annonce sur ${merchantName}",
      "category": "Catégorie (Montres, Sneakers, Luxe, Électronique, Retro Gaming, Mode, Bijoux, Mobilier, Art, Vinyles)",
      "description": "Explication experte de pourquoi c'est une bonne affaire : état estimé, raison de la sous-évaluation, où et comment revendre, délai de revente estimé",
      "imageKeyword": "mot-clé anglais simple pour trouver une image (watch, sneakers, handbag, phone, laptop, console, jewelry, furniture, camera, vintage, gaming, clothing, bag, bike, book, vinyl, electronics, art, shoes)",
      "adUrl": "URL directe vers l'annonce si visible dans les captures, sinon URL de recherche sur la plateforme",
      "adImageUrl": "URL de l'image du produit si visible dans les captures, sinon chaîne vide"
    }
  ]
}

Génère entre 2 et 5 pépites réalistes basées sur ce que tu vois dans les captures. Varie les catégories.`;
}

function buildTextOnlyPrompt(merchantName: string, pageContent: string): string {
  return `Tu es un EXPERT en achat-revente et flipping depuis 15 ans. Tu connais parfaitement les cotes du marché de l'occasion en France.

TON EXPERTISE :
- Tu maîtrises les prix du marché de revente pour : montres de luxe, sneakers limitées, sacs de marque, électronique, consoles retro, vinyles, mobilier design, art, bijoux, vêtements de marque
- Tu sais identifier les annonces sous-évaluées en quelques secondes
- Tu connais les techniques de revente (eBay, Vinted, Vestiaire Collective, marchés spécialisés)
- Tu calcules le profit NET réaliste (après frais de plateforme ~10-15%, envoi ~5-10€)

CONTEXTE DU SCAN :
L'utilisateur navigue sur "${merchantName}".
${pageContent ? `Voici le contenu extrait de la page :\n---\n${pageContent.substring(0, 8000)}\n---` : `Analyse les types de produits typiquement vendus sur ${merchantName}.`}

MISSION :
Analyse le contenu et identifie les VRAIES bonnes affaires. Si le contenu de la page contient des annonces réelles, analyse-les. Sinon, génère des exemples réalistes basés sur ce qu'on trouve typiquement sur ${merchantName}.

CRITÈRES DE SÉLECTION D'UNE PÉPITE :
1. Le prix demandé est au minimum 30% en dessous de la valeur marché
2. Le produit a une demande forte et se revend facilement
3. Le profit potentiel justifie l'effort (minimum 40€ de profit)
4. L'état du produit est acceptable pour la revente

IMPORTANT : Sois réaliste dans tes estimations. Pas de profits fantaisistes.

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backticks, dans ce format exact :
{
  "pepites": [
    {
      "title": "Nom précis du produit (marque, modèle, taille/ref si pertinent)",
      "sellerPrice": 0,
      "estimatedValue": 0,
      "profit": 0,
      "source": "${merchantName}",
      "sourceUrl": "URL réelle ou plausible de l'annonce sur ${merchantName}",
      "category": "Catégorie (Montres, Sneakers, Luxe, Électronique, Retro Gaming, Mode, Bijoux, Mobilier, Art, Vinyles)",
      "description": "Explication experte de pourquoi c'est une bonne affaire",
      "imageKeyword": "mot-clé anglais simple pour trouver une image",
      "adUrl": "URL directe vers l'annonce si disponible",
      "adImageUrl": "URL de l'image du produit si disponible, sinon chaîne vide"
    }
  ]
}

Génère entre 2 et 5 pépites réalistes. Varie les catégories.`;
}

function parseGeminiResponse(data: GeminiResponse, merchantName: string): Pepite[] {
  if (data.error) {
    console.error('[ScanService] Gemini returned error:', data.error);
    throw new Error(data.error.message ?? 'Erreur inconnue de Gemini');
  }

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    console.error('[ScanService] No text content in Gemini response');
    throw new Error('Réponse vide de Gemini. Réessayez.');
  }

  console.log('[ScanService] Raw Gemini text:', textContent.substring(0, 500));

  let parsed: { pepites: GeminiPepite[] };
  try {
    const cleanJson = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseError) {
    console.error('[ScanService] Failed to parse Gemini JSON:', parseError);
    console.error('[ScanService] Raw text was:', textContent);
    throw new Error('Erreur de parsing de la réponse IA. Réessayez.');
  }

  if (!parsed.pepites || !Array.isArray(parsed.pepites) || parsed.pepites.length === 0) {
    console.log('[ScanService] No pepites found in analysis');
    return [];
  }

  console.log(`[ScanService] Gemini found ${parsed.pepites.length} pepites`);

  const now = new Date();
  const pepites: Pepite[] = parsed.pepites.map((p, index) => {
    const imageUrl = p.adImageUrl && p.adImageUrl.length > 0
      ? p.adImageUrl
      : getImageForQuery(p.imageKeyword ?? 'default');

    return {
      id: `gemini_${Date.now()}_${index}`,
      title: p.title ?? 'Produit détecté',
      image: imageUrl,
      sellerPrice: p.sellerPrice ?? 0,
      estimatedValue: p.estimatedValue ?? 0,
      profit: p.profit ?? ((p.estimatedValue ?? 0) - (p.sellerPrice ?? 0)),
      source: p.source ?? merchantName,
      sourceUrl: p.adUrl ?? p.sourceUrl ?? '',
      category: p.category ?? 'Divers',
      description: p.description ?? 'Bonne affaire détectée par l\'IA',
      scanDate: new Date(now.getTime() - index * 60000).toISOString(),
      isFavorite: false,
      isTrashed: false,
    };
  });

  return pepites;
}

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGeminiApi(apiKey: string, parts: GeminiPart[]): Promise<GeminiResponse> {
  const requestBody = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  };

  console.log(`[ScanService] Calling Gemini API with ${parts.length} parts`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.log(`[ScanService] Retry ${attempt}/${MAX_RETRIES} after ${Math.round(backoff)}ms`);
      await delay(backoff);
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      return response.json();
    }

    const errorText = await response.text();
    console.error(`[ScanService] Gemini API error ${response.status} (attempt ${attempt + 1}):`, errorText);

    if (response.status === 429 || response.status === 503) {
      if (attempt < MAX_RETRIES) {
        console.log(`[ScanService] Rate limited, will retry...`);
        continue;
      }
      throw new Error('Quota API dépassé. Vérifiez votre plan Gemini ou réessayez dans quelques minutes.');
    }

    if (response.status === 400) {
      throw new Error('Clé API invalide ou requête malformée. Vérifiez votre clé dans les réglages.');
    }
    if (response.status === 403) {
      throw new Error('Clé API non autorisée. Vérifiez que votre clé Gemini est active.');
    }
    throw new Error(`Erreur API Gemini (${response.status}). Réessayez.`);
  }

  throw new Error('Impossible de joindre l\'API Gemini après plusieurs tentatives.');
}

export async function analyzeWithGeminiVideo(
  apiKey: string,
  merchantName: string,
  screenshots: string[],
  pageContent: string,
): Promise<Pepite[]> {
  if (!apiKey || apiKey.trim().length === 0) {
    console.error('[ScanService] No Gemini API key provided');
    throw new Error('Clé API Gemini non configurée. Allez dans Réglages > Clé API pour la configurer.');
  }

  console.log(`[ScanService] Video analysis: ${screenshots.length} frames for ${merchantName}`);
  console.log(`[ScanService] Supplementary text: ${pageContent.length} chars`);

  const parts: GeminiPart[] = [];

  const prompt = buildVideoExpertPrompt(merchantName, pageContent, screenshots.length);
  parts.push({ text: prompt });

  for (let i = 0; i < screenshots.length; i++) {
    const base64 = screenshots[i];
    if (base64 && base64.length > 100) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64,
        },
      });
      console.log(`[ScanService] Added frame ${i + 1}: ${Math.round(base64.length / 1024)}KB`);
    }
  }

  if (parts.length === 1) {
    console.log('[ScanService] No valid screenshots, falling back to text-only analysis');
    return analyzeWithGemini(apiKey, merchantName, pageContent);
  }

  const data = await callGeminiApi(apiKey, parts);
  console.log('[ScanService] Gemini video analysis response received');

  return parseGeminiResponse(data, merchantName);
}

export async function analyzeWithGemini(
  apiKey: string,
  merchantName: string,
  pageContent: string,
): Promise<Pepite[]> {
  if (!apiKey || apiKey.trim().length === 0) {
    console.error('[ScanService] No Gemini API key provided');
    throw new Error('Clé API Gemini non configurée. Allez dans Réglages > Clé API pour la configurer.');
  }

  const prompt = buildTextOnlyPrompt(merchantName, pageContent);
  console.log(`[ScanService] Text-only analysis for: ${merchantName}`);
  console.log(`[ScanService] Page content length: ${pageContent.length} chars`);

  const parts: GeminiPart[] = [{ text: prompt }];
  const data = await callGeminiApi(apiKey, parts);
  console.log('[ScanService] Gemini text analysis response received');

  return parseGeminiResponse(data, merchantName);
}

export function generateFallbackPepites(merchantName: string): Pepite[] {
  const fallbackItems = [
    {
      title: 'Rolex Datejust 36mm 1978',
      sellerPrice: 2800,
      estimatedValue: 5500,
      profit: 2700,
      source: merchantName,
      sourceUrl: `https://www.${merchantName.toLowerCase().replace(/\s/g, '')}.fr`,
      category: 'Montres',
      description: 'Rolex Datejust vintage en or et acier. Cadran champagne en excellent état. Le vendeur liquide une succession.',
      image: UNSPLASH_IMAGES.watch,
    },
    {
      title: 'Sac Louis Vuitton Speedy 30',
      sellerPrice: 180,
      estimatedValue: 650,
      profit: 470,
      source: merchantName,
      sourceUrl: `https://www.${merchantName.toLowerCase().replace(/\s/g, '')}.fr`,
      category: 'Luxe / Maroquinerie',
      description: 'Speedy 30 en toile Monogram avec patine miel. La vendeuse pense que c\'est une copie mais les codes confirment l\'authenticité.',
      image: UNSPLASH_IMAGES.handbag,
    },
    {
      title: 'Nintendo 64 + 12 jeux',
      sellerPrice: 45,
      estimatedValue: 220,
      profit: 175,
      source: merchantName,
      sourceUrl: `https://www.${merchantName.toLowerCase().replace(/\s/g, '')}.fr`,
      category: 'Retro Gaming',
      description: 'Lot N64 complet avec 12 jeux dont Zelda OOT et Mario 64. Les jeux seuls valent plus que le prix demandé.',
      image: UNSPLASH_IMAGES.gaming,
    },
  ];

  const now = new Date();
  return fallbackItems.map((item, index) => ({
    ...item,
    id: `fallback_${Date.now()}_${index}`,
    scanDate: new Date(now.getTime() - index * 60000).toISOString(),
    isFavorite: false,
    isTrashed: false,
  }));
}
