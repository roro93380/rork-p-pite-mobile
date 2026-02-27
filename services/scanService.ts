import { Pepite } from '@/types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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

function buildVideoPrompt(merchantName: string, pageContent: string): string {
  return `Tu es un EXPERT en achat-revente et flipping depuis 15 ans. Tu connais parfaitement les cotes du marché de l'occasion en France.

Tu vas recevoir des images (captures d'écran de l'application) ET un bloc de données textuelles (JSON intercepté de l'API et textes visibles de la page) provenant de "${merchantName}".

${pageContent ? `\n--- DONNÉES INTERCEPTÉES (API JSON & TEXTES) ---\n${pageContent.substring(0, 15000)}\n--- FIN DES DONNÉES ---` : ''}

MISSION CROISÉE :
1. Regarde attentivement les images pour identifier les produits VUS par l'utilisateur.
2. Utilise le bloc de données interceptées pour retrouver les URLs (adUrl) et URLs d'images (adImageUrl) EXCACTES correspondant aux produits vus sur les images.

RÈGLE ABSOLUE : Trouve les VRAIES bonnes affaires (prix au moins 8% sous la cote). Tout profit compte, même 5€. N'invente jamais d'annonces.

Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks :
{
  "pepites": [
    {
      "title": "Nom EXACT du produit",
      "sellerPrice": 0,
      "estimatedValue": 0,
      "profit": 0,
      "source": "${merchantName}",
      "sourceUrl": "URL de base de la plateforme",
      "category": "Catégorie du produit",
      "description": "Pourquoi c'est une bonne affaire",
      "imageKeyword": "mot-clé anglais (watch, sneakers, phone...)",
      "adUrl": "L'URL réelle du produit, trouvée dans les données interceptées",
      "adImageUrl": "L'URL de l'image (copie INTÉGRALEMENT depuis les données interceptées. Ne la tronque JAMAIS)"
    }
  ]
}`;
}

function buildTextOnlyPrompt(merchantName: string, pageContent: string): string {
  return `Tu es un EXPERT en achat-revente et flipping depuis 15 ans.

L'utilisateur navigue sur "${merchantName}". Voici les données réseau interceptées en arrière-plan :
${pageContent ? `\n---\n${pageContent.substring(0, 15000)}\n---` : `Aucune donnée.`}

MISSION :
Analyse ces données pour y dénicher des annonces sous-évaluées d'au moins 8%. Ne te base que sur ces données.

Réponds UNIQUEMENT avec un JSON valide, sans markdown, dans ce format exact :
{
  "pepites": [
    {
      "title": "Titre",
      "sellerPrice": 0,
      "estimatedValue": 0,
      "profit": 0,
      "source": "${merchantName}",
      "sourceUrl": "",
      "category": "Catégorie",
      "description": "Justification du profit",
      "imageKeyword": "mot-clé anglais",
      "adUrl": "L'URL exacte depuis le JSON",
      "adImageUrl": "L'URL entière de l'image depuis le JSON sans la couper"
    }
  ]
}`;
}

function tryRepairIncompleteObject(raw: string): GeminiPepite | null {
  try {
    let fixed = raw.trim();
    if (fixed.endsWith(',')) fixed = fixed.slice(0, -1);
    
    const lastQuoteIdx = fixed.lastIndexOf('"');
    if (lastQuoteIdx === -1) return null;
    
    const afterLastQuote = fixed.substring(lastQuoteIdx + 1).trim();
    if (afterLastQuote === '' || afterLastQuote === ':') {
      const lastKeyMatch = fixed.match(/,\s*"[^"]+"\s*:?\s*$/s);
      if (lastKeyMatch && lastKeyMatch.index !== undefined) {
        fixed = fixed.substring(0, lastKeyMatch.index);
      } else {
        return null;
      }
    } else if (!afterLastQuote.endsWith('}')) {
      const lastCompleteField = fixed.lastIndexOf(',"');
      if (lastCompleteField > 0) {
        fixed = fixed.substring(0, lastCompleteField);
      }
    }
    
    if (!fixed.endsWith('}')) {
      fixed += '}';
    }
    
    const obj = JSON.parse(fixed);
    if (obj.title && (obj.sellerPrice !== undefined || obj.estimatedValue !== undefined)) {
      if (!obj.adImageUrl) obj.adImageUrl = '';
      if (!obj.adUrl) obj.adUrl = '';
      if (!obj.sourceUrl) obj.sourceUrl = '';
      if (!obj.imageKeyword) obj.imageKeyword = 'default';
      if (!obj.category) obj.category = 'Divers';
      if (!obj.description) obj.description = 'Bonne affaire détectée';
      if (!obj.source) obj.source = '';
      if (!obj.profit) obj.profit = (obj.estimatedValue ?? 0) - (obj.sellerPrice ?? 0);
      return obj as GeminiPepite;
    }
    return null;
  } catch {
    return null;
  }
}

function repairTruncatedJson(raw: string): { pepites: GeminiPepite[] } {
  let text = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  try {
    const direct = JSON.parse(text);
    if (direct.pepites && Array.isArray(direct.pepites)) return direct;
  } catch {}

  const pepitesMatch = text.match(/"pepites"\s*:\s*\[/);
  if (!pepitesMatch || pepitesMatch.index === undefined) {
    throw new Error('Cannot repair: no pepites array found');
  }

  const arrayStart = pepitesMatch.index + pepitesMatch[0].length;
  const arrayContent = text.substring(arrayStart);

  const completePepites: GeminiPepite[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let objectStart = -1;

  for (let i = 0; i < arrayContent.length; i++) {
    const ch = arrayContent[i];

    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objectStart >= 0) {
        const obj = arrayContent.substring(objectStart, i + 1);
        try {
          const parsed = JSON.parse(obj);
          completePepites.push(parsed);
        } catch {}
        objectStart = -1;
      }
    }
  }

  if (depth > 0 && objectStart >= 0) {
    const incompleteObj = arrayContent.substring(objectStart);
    const repaired = tryRepairIncompleteObject(incompleteObj);
    if (repaired) completePepites.push(repaired);
  }

  if (completePepites.length === 0) {
    throw new Error('Cannot repair: no complete pepite objects found');
  }

  return { pepites: completePepites };
}

function parseGeminiResponse(data: GeminiResponse, merchantName: string): Pepite[] {
  if (data.error) throw new Error(data.error.message ?? 'Erreur inconnue de Gemini');

  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) throw new Error('Réponse vide de Gemini. Réessayez.');

  let parsed: { pepites: GeminiPepite[] };
  try {
    const cleanJson = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseError) {
    try {
      parsed = repairTruncatedJson(textContent);
    } catch (repairError) {
      throw new Error('Erreur de parsing de la réponse IA. Réessayez.');
    }
  }

  if (!parsed.pepites || !Array.isArray(parsed.pepites) || parsed.pepites.length === 0) {
    return [];
  }

  const now = new Date();
  const pepites: Pepite[] = parsed.pepites.map((p, index) => {
    const isValidCompleteUrl = (url: string) => {
      if (!url || url.length < 10) return false;
      if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
      if (url.endsWith('...') || url.includes('\n')) return false;
      return url.includes('.') && (url.includes('/') || url.includes('?'));
    };

    const imageUrl = p.adImageUrl && isValidCompleteUrl(p.adImageUrl)
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
      sourceUrl: (p.adUrl && p.adUrl.startsWith('http') ? p.adUrl : '') || (p.sourceUrl && p.sourceUrl.startsWith('http') ? p.sourceUrl : ''),
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

async function callGeminiApi(apiKey: string, parts: GeminiPart[], isVideo: boolean = false): Promise<GeminiResponse> {
  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 65536,
      responseMimeType: 'application/json',
    },
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await delay(backoff);
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (response.ok) return response.json();

    if (response.status === 429 || response.status === 503) {
      if (attempt < MAX_RETRIES) continue;
      throw new Error('Quota API dépassé. Vérifiez votre plan Gemini ou réessayez dans quelques minutes.');
    }
    if (response.status === 400) throw new Error('Clé API invalide ou requête malformée. Vérifiez votre clé dans les réglages.');
    if (response.status === 403) throw new Error('Clé API non autorisée. Vérifiez que votre clé Gemini est active.');
    
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
  if (!apiKey || apiKey.trim().length === 0) throw new Error('Clé API Gemini non configurée.');

  const validFrames = screenshots.filter(s => s && s.length > 100);
  if (validFrames.length === 0) return analyzeWithGemini(apiKey, merchantName, pageContent);

  const maxFrames = 6;
  let selectedFrames: string[];
  if (validFrames.length <= maxFrames) {
    selectedFrames = validFrames;
  } else {
    selectedFrames = [];
    const step = (validFrames.length - 1) / (maxFrames - 1);
    for (let i = 0; i < maxFrames; i++) {
      selectedFrames.push(validFrames[Math.round(i * step)]);
    }
  }

  const prompt = buildVideoPrompt(merchantName, pageContent);
  const parts: GeminiPart[] = [{ text: prompt }];
  for (const frame of selectedFrames) {
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: frame } });
  }

  const data = await callGeminiApi(apiKey, parts);
  return parseGeminiResponse(data, merchantName);
}

export async function analyzeWithGemini(
  apiKey: string,
  merchantName: string,
  pageContent: string,
): Promise<Pepite[]> {
  if (!apiKey || apiKey.trim().length === 0) throw new Error('Clé API Gemini non configurée.');

  const prompt = buildTextOnlyPrompt(merchantName, pageContent);
  const parts: GeminiPart[] = [{ text: prompt }];
  const data = await callGeminiApi(apiKey, parts);
  
  return parseGeminiResponse(data, merchantName);
}

export function generateFallbackPepites(merchantName: string): Pepite[] {
  // Gardé tel quel
  return []; 
}