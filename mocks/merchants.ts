export interface Merchant {
  id: string;
  name: string;
  logo: string;
  url: string;
  color: string;
  category: string;
  description: string;
}

export const MERCHANTS: Merchant[] = [
  {
    id: 'leboncoin',
    name: 'Leboncoin',
    logo: '🟠',
    url: 'https://www.leboncoin.fr',
    color: '#FF6E14',
    category: 'Généraliste',
    description: 'Petites annonces entre particuliers',
  },
  {
    id: 'vinted',
    name: 'Vinted',
    logo: '🟢',
    url: 'https://www.vinted.fr',
    color: '#09B1BA',
    category: 'Mode & Accessoires',
    description: 'Vêtements, chaussures et accessoires',
  },
  {
    id: 'ebay',
    name: 'eBay',
    logo: '🔴',
    url: 'https://www.ebay.fr',
    color: '#E53238',
    category: 'Enchères & Achat',
    description: 'Enchères et achat immédiat',
  },
  {
    id: 'facebook',
    name: 'Marketplace',
    logo: '🔵',
    url: 'https://www.facebook.com/marketplace',
    color: '#1877F2',
    category: 'Réseau social',
    description: 'Facebook Marketplace',
  },
  {
    id: 'rakuten',
    name: 'Rakuten',
    logo: '🟣',
    url: 'https://fr.shopping.rakuten.com',
    color: '#BF0000',
    category: 'Marketplace',
    description: 'Produits neufs et occasion',
  },
  {
    id: 'backmarket',
    name: 'Back Market',
    logo: '♻️',
    url: 'https://www.backmarket.fr',
    color: '#00CC6A',
    category: 'Reconditionné',
    description: 'Électronique reconditionné',
  },
  {
    id: 'vestiaire',
    name: 'Vestiaire Collective',
    logo: '👜',
    url: 'https://www.vestiairecollective.com',
    color: '#1A1A1A',
    category: 'Luxe',
    description: 'Mode de luxe seconde main',
  },
  {
    id: 'selency',
    name: 'Selency',
    logo: '🪑',
    url: 'https://www.selency.com',
    color: '#D4A574',
    category: 'Mobilier & Déco',
    description: 'Mobilier vintage et design',
  },
];
