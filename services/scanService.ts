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

Tu reçois une vidéo d'enregistrement d'écran d'un utilisateur qui navigue sur "${merchantName}". C'est un enregistrement réel de son téléphone.
${pageContent ? `\nDonnées textuelles extraites en complément :\n---\n${pageContent.substring(0, 6000)}\n---` : ''}

MISSION :
Regarde attentivement cette vidéo. Identifie TOUTES les annonces visibles : titres, prix, photos, descriptions.
Trouve les VRAIES bonnes affaires RÉELLEMENT VISIBLES.

RÈGLE ABSOLUE : Ne JAMAIS inventer d'annonces. UNIQUEMENT celles visibles dans la vidéo. Si aucune annonce réelle avec titre et prix, retourne : {"pepites": []}.

CRITÈRES :
1. L'annonce DOIT être visible dans la vidéo (titre ET prix)
2. Prix au minimum 8% sous la valeur marché de revente
3. Produit revendable
4. Tout profit compte, même 5-10€

Sois TRÈS inclusif. Dès 8% de marge = pépite.

Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "pepites": [
    {
      "title": "Nom EXACT du produit vu dans l'annonce",
      "sellerPrice": 0,
      "estimatedValue": 0,
      "profit": 0,
      "source": "${merchantName}",
      "sourceUrl": "URL réelle si visible",
      "category": "Catégorie",
      "description": "Pourquoi c'est une bonne affaire",
      "imageKeyword": "mot-clé anglais (watch, sneakers, handbag, phone, laptop, console, jewelry, furniture, camera, vintage, gaming, clothing, bag, bike, book, vinyl, electronics, art, shoes)",
      "adUrl": "URL de l'annonce si visible",
      "adImageUrl": "URL COMPLÈTE de l'image produit si visible (IMPORTANT: copie l'URL entière sans la couper), sinon chaîne vide"
    }
  ]
}

IMPORTANT : Chaque objet JSON doit être COMPLET. Ne coupe JAMAIS une URL en plein milieu. Si l'URL est trop longue, mets une chaîne vide plutôt que de la tronquer.

Retourne 1-10 pépites. Si aucune annonce réelle : {"pepites": []}.`;
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
${pageContent ? `Voici le contenu RÉEL extrait de la page :\n---\n${pageContent.substring(0, 8000)}\n---` : `ATTENTION : Aucune donnée de page n'a pu être extraite. Retourne un tableau vide.`}

MISSION :
Analyse UNIQUEMENT le contenu RÉEL fourni ci-dessus. Identifie les bonnes affaires parmi les annonces RÉELLEMENT présentes dans les données.

RÈGLE ABSOLUE : Tu ne dois JAMAIS inventer, simuler ou imaginer des annonces. Tu dois UNIQUEMENT rapporter des annonces RÉELLEMENT présentes dans les données extraites ci-dessus. Si les données ne contiennent aucune annonce avec un titre et un prix, ou si aucune donnée n'a été extraite, retourne : {"pepites": []}

CRITÈRES DE SÉLECTION D'UNE PÉPITE :
1. L'annonce DOIT être réellement présente dans les données extraites (titre ET prix visibles)
2. Le prix demandé est au minimum 8% en dessous de la valeur marché de revente (même une petite marge compte !)
3. Le produit peut se revendre (pas besoin que ce soit ultra-demandé)
4. Tout profit est bon à prendre, même 5€ ou 10€
5. L'état du produit semble acceptable pour la revente

IMPORTANT : Sois TRÈS inclusif. Dès qu'il y a 8% de marge ou plus, c'est une pépite.

Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans backticks, dans ce format exact :
{
  "pepites": [
    {
      "title": "Nom EXACT du produit tel que vu dans l'annonce",
      "sellerPrice": 0,
      "estimatedValue": 0,
      "profit": 0,
      "source": "${merchantName}",
      "sourceUrl": "URL réelle de l'annonce extraite des données",
      "category": "Catégorie (Montres, Sneakers, Luxe, Électronique, Retro Gaming, Mode, Bijoux, Mobilier, Art, Vinyles)",
      "description": "Explication experte de pourquoi c'est une bonne affaire",
      "imageKeyword": "mot-clé anglais simple pour trouver une image",
      "adUrl": "URL directe vers l'annonce RÉELLE extraite des données",
      "adImageUrl": "URL COMPLÈTE de l'image du produit RÉELLE extraite des données (IMPORTANT: copie l'URL entière sans la couper), sinon chaîne vide"
    }
  ]
}

IMPORTANT : Chaque objet JSON doit être COMPLET. Ne coupe JAMAIS une URL en plein milieu. Si l'URL est trop longue, mets une chaîne vide plutôt que de la tronquer.

Sois GÉNÉREUX dans ta sélection : retourne entre 1 et 10 pépites si tu en trouves. La moindre marge de 8% suffit. Si aucune annonce réelle n'est trouvée, retourne : {"pepites": []}.`;
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
      console.log(`[ScanService] Repaired incomplete object: ${obj.title}`);
      return obj as GeminiPepite;
    }
    return null;
  } catch {
    return null;
  }
}

function repairTruncatedJson(raw: string): { pepites: GeminiPepite[] } {
  let text = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  console.log('[ScanService] Attempting JSON repair, text length:', text.length);

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

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
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
          console.log(`[ScanService] Recovered complete object #${completePepites.length}: ${parsed.title}`);
        } catch {
          console.log('[ScanService] Skipping malformed object');
        }
        objectStart = -1;
      }
    }
  }

  if (depth > 0 && objectStart >= 0) {
    console.log('[ScanService] Found truncated object at end, attempting repair...');
    const incompleteObj = arrayContent.substring(objectStart);
    const repaired = tryRepairIncompleteObject(incompleteObj);
    if (repaired) {
      completePepites.push(repaired);
      console.log(`[ScanService] Successfully repaired truncated object: ${repaired.title}`);
    }
  }

  if (completePepites.length === 0) {
    throw new Error('Cannot repair: no complete pepite objects found');
  }

  console.log(`[ScanService] Successfully recovered ${completePepites.length} pepites from truncated response`);
  return { pepites: completePepites };
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

  console.log('[ScanService] ========== GEMINI RAW RESPONSE ==========');
  console.log('[ScanService] Response length:', textContent.length, 'chars');
  console.log('[ScanService] Raw text:', textContent.substring(0, 800));

  let parsed: { pepites: GeminiPepite[] };
  try {
    const cleanJson = textContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(cleanJson);
  } catch (parseError) {
    console.log('[ScanService] Initial parse failed, attempting to recover truncated JSON...');
    try {
      parsed = repairTruncatedJson(textContent);
    } catch (repairError) {
      console.error('[ScanService] Failed to repair JSON:', repairError);
      console.error('[ScanService] Raw text was:', textContent.substring(0, 1000));
      throw new Error('Erreur de parsing de la réponse IA. Réessayez.');
    }
  }

  if (!parsed.pepites || !Array.isArray(parsed.pepites) || parsed.pepites.length === 0) {
    console.log('[ScanService] ⚠️ No pepites found in Gemini analysis - empty array returned');
    return [];
  }

  console.log(`[ScanService] ✅ Gemini found ${parsed.pepites.length} pepites!`);
  parsed.pepites.forEach((p, i) => {
    console.log(`[ScanService]   #${i + 1}: ${p.title} | ${p.sellerPrice}€ → ${p.estimatedValue}€ (profit: ${p.profit}€)`);
  });

  const now = new Date();
  const pepites: Pepite[] = parsed.pepites.map((p, index) => {
    const isValidCompleteUrl = (url: string) => {
      if (!url || url.length < 10) return false;
      if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
      if (url.endsWith('...') || url.includes('\n')) return false;
      const hasExtOrPath = url.includes('.') && (url.includes('/') || url.includes('?'));
      return hasExtOrPath;
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
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 16384,
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

function createMjpegVideoFromFrames(frames: string[]): string {
  const binaryFrames: Uint8Array[] = [];
  for (const base64 of frames) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    binaryFrames.push(bytes);
  }

  const totalSize = binaryFrames.reduce((sum, f) => sum + f.length, 0);
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const frame of binaryFrames) {
    combined.set(frame, offset);
    offset += frame.length;
  }

  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < combined.length; i += chunkSize) {
    const chunk = combined.subarray(i, Math.min(i + chunkSize, combined.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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

  console.log('[ScanService] ========== VIDEO ANALYSIS START ==========');
  console.log(`[ScanService] Merchant: ${merchantName}`);
  console.log(`[ScanService] Total frames captured: ${screenshots.length}`);
  console.log(`[ScanService] Text content: ${pageContent.length} chars`);

  const validFrames = screenshots.filter(s => s && s.length > 100);
  console.log(`[ScanService] Valid frames: ${validFrames.length}`);

  if (validFrames.length === 0) {
    console.log('[ScanService] No valid frames, falling back to text-only analysis');
    return analyzeWithGemini(apiKey, merchantName, pageContent);
  }

  const maxFrames = 6;
  let selectedFrames: string[];
  if (validFrames.length <= maxFrames) {
    selectedFrames = validFrames;
  } else {
    selectedFrames = [];
    const step = (validFrames.length - 1) / (maxFrames - 1);
    for (let i = 0; i < maxFrames; i++) {
      const idx = Math.round(i * step);
      selectedFrames.push(validFrames[idx]);
    }
  }
  console.log(`[ScanService] Selected ${selectedFrames.length} key frames for video`);

  const prompt = buildVideoPrompt(merchantName, pageContent);
  console.log(`[ScanService] Prompt length: ${prompt.length} chars`);

  const parts: GeminiPart[] = [{ text: prompt }];
  for (const frame of selectedFrames) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: frame,
      },
    });
  }

  console.log(`[ScanService] Sending ${selectedFrames.length} images + prompt to Gemini`);
  const data = await callGeminiApi(apiKey, parts);
  console.log('[ScanService] Gemini image analysis response received');
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

  console.log('[ScanService] ========== TEXT-ONLY ANALYSIS START ==========');
  console.log(`[ScanService] Merchant: ${merchantName}`);
  console.log(`[ScanService] Page content: ${pageContent.length} chars`);
  if (pageContent.length > 0) {
    console.log(`[ScanService] Content preview: ${pageContent.substring(0, 500)}`);
  } else {
    console.warn('[ScanService] ⚠️ NO PAGE CONTENT - analysis will likely return empty results');
  }

  const prompt = buildTextOnlyPrompt(merchantName, pageContent);
  console.log(`[ScanService] Prompt length: ${prompt.length} chars`);

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
