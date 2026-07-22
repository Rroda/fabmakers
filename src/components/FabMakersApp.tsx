"use client";

// Supply-first (D004): UI prioriza fab/maker. Later/Cut ficam atrás de SHOW_LATER_UI.
// Layer B (D007): rotas / /client /quote /maker /admin — shell estável no layout (app).
import { useState, useRef, DragEvent, ChangeEvent, useEffect, useCallback } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import logoMark from "../logo/logo-mark.png";
import { PRINTER_PRESETS } from "../lib/printerPresets";
import { Icon } from "@/components/Icon";
import { CURATED_CATALOG, getCuratedStlUrl, type CuratedModel } from "@/lib/curatedCatalog";
import {
  appStateToPath,
  pathToAppState,
  type AppTab,
  type HomeMode,
} from "@/lib/appRoutes";
import { loadSession, saveSession, adminAuthHeaders, makerAuthHeaders, getMakerToken } from "@/lib/session";

// Interface para dados do fatiador STL
interface QuoteData {
  success: boolean;
  filename: string;
  trianglesCount: number;
  boundingBox: {
    width: number;
    depth: number;
    height: number;
  };
  metrics: {
    rawVolumeMm3: number;
    realVolumeCm3: number;
    weightG: number;
    timeHours: number;
    timeFormatted: string;
  };
  pricing: {
    materialCost: number;
    machineCost: number;
    makerProfit: number;
    makerPayout: number;
    platformFee: number;
    royaltyPrice: number;
    totalPrice: number;
  };
}

// Interface para pedidos interativos e simulados
interface SimulatedOrder {
  id: string;
  filename: string;
  status: "WAITING_MAKER" | "PRINTING" | "SHIPPED" | "COMPLETED" | "CANCELLED";
  totalPrice: number;
  weightG: number;
  timeFormatted: string;
  progress: number;
  material: string;
  zipCode: string;
  makerId?: string;
  makerName?: string;
  infill?: number;
  createdAt: string;
  makerPayout?: number;
  platformFee?: number;
  catalogId?: string | null;
}

// Interface para impressoras cadastradas
interface Machine {
  id: string;
  brand: string;
  model: string;
  nozzle: string;
  volume: string;
  technology: string;
  hasEnclosure: boolean;
  hasMulticolor: boolean;
  maxNozzleTemp: number;
  maxBedTemp: number;
  compatibleMaterials: string[];
  supportedNozzles: string[];
  typicalPrecision: number;
  maxSpeed: number;
  maxPartWeightG: number;
  releaseYear: number;
  status: string;
}

// Interface para filamentos
interface Filament {
  id: string;
  type: string;
  color: string;
  weightG: number;
}

// Interface para perfil de Maker
interface MakerProfile {
  id?: string;
  name: string;
  zipCode: string;
  rating: number;
  penalties: number;
  isBanned: boolean;
  isApproved: boolean;
  machines: Machine[];
  filaments: Filament[];
  availability: {
    days: string[]; // ['seg', 'ter', 'qua'...]
    shifts: string[]; // ['manha', 'tarde', 'noite']
    months: string[]; // ['jan', 'fev'...]
    dailyHours?: Record<string, number>;
  };
  // Onboarding Anti-Fraude e Contrato SLA
  contractAccepted: boolean;
  kycStatus: "PENDING" | "APPROVED" | "REJECTED";
  makerStatus: "UNVERIFIED" | "PENDING_APPROVAL" | "SANDBOX" | "HOMOLOGATED" | "APPROVED" | "BANNED";
  kycDocumentUrl?: string;
  kycDocFrontUrl?: string;
  kycDocBackUrl?: string;
  kycSelfieUrl?: string;
  emailVerified?: boolean;
  calibX?: number;
  calibY?: number;
  calibZ?: number;
  calibImageUrl?: string;
}

// Interface para solicitações de homologação na fila do Admin
interface HomologationRequest {
  id: string;
  name: string;
  zipCode: string;
  machineModel: string;
  benchmarkResult: "PENDING" | "APPROVED" | "REJECTED";
  benchmarkImageUrl: string;
  
  // Dados de KYC e medições físicas de paquímetro para o Admin auditar
  documentUrl: string;
  selfieUrl: string;
  calibX: number;
  calibY: number;
  calibZ: number;
  createdAt: string;
}

const materialDetails = {
  PLA: {
    name: "PLA (Poliácido Láctico)",
    description: "Biodegradável e derivado de amido de milho. O filamento mais fácil de imprimir, com excelente acabamento estético e precisão dimensional.",
    resistance: "Baixa a média mecânica. Baixa térmica (amolece acima de 55°C). Pouco flexível.",
    application: "Prototipagem rápida, peças decorativas, action figures, maquetes e modelos conceituais.",
    colors: [
      { name: "Preto Matte", hex: "#1e1e1e" },
      { name: "Branco Neve", hex: "#fcfcfc" },
      { name: "Vermelho Rubi", hex: "#dc2626" },
      { name: "Azul Cobalto", hex: "#2563eb" },
      { name: "Verde Esmeralda", hex: "#16a34a" },
      { name: "Laranja Neon", hex: "#ea580c" },
      { name: "Cinza Espacial", hex: "#71717a" }
    ]
  },
  ABS: {
    name: "ABS (Acrilonitrila Butadieno Estireno)",
    description: "Plástico robusto derivado do petróleo. Altamente resistente ao impacto, tenaz e ideal para pós-processamento de suavização com acetona.",
    resistance: "Alta mecânica, alta tenacidade. Alta resistência térmica (resiste até 85°C). Excelente durabilidade.",
    application: "Peças mecânicas, protótipos funcionais sujeitos a estresse mecânico, cases de eletrônicos e utilitários robustos.",
    colors: [
      { name: "Preto Industrial", hex: "#0f0f10" },
      { name: "Cinza Chumbo", hex: "#4b5563" },
      { name: "Branco Puro", hex: "#f9fafb" },
      { name: "Vermelho Alerta", hex: "#b91c1c" },
      { name: "Azul Marinho", hex: "#1e3a8a" },
      { name: "Amarelo Segurança", hex: "#facc15" }
    ]
  },
  PETG: {
    name: "PETG (Polietileno Tereftalato de Glicol)",
    description: "Combina a facilidade de impressão do PLA com a durabilidade mecânica do ABS. Ótima aderência entre camadas, resistência química e proteção UV.",
    resistance: "Alta tenacidade, boa flexibilidade. Resistência térmica intermediária (resiste até 75°C). Resistente a intempéries e luz solar.",
    application: "Peças para uso externo, suportes industriais, garrafas, recipientes à prova d'água e adaptadores.",
    colors: [
      { name: "Preto Translúcido", hex: "#1c1917" },
      { name: "Azul Translúcido", hex: "#3b82f6" },
      { name: "Vermelho Translúcido", hex: "#ef4444" },
      { name: "Verde Translúcido", hex: "#10b981" },
      { name: "Branco Leitoso", hex: "#f3f4f6" }
    ]
  },
  Resina: {
    name: "Resina Fotorreativa (SLA)",
    description: "Cura líquida microscópica por laser/painel UV. Fornece uma resolução de detalhes impressionante com superfícies perfeitamente lisas.",
    resistance: "Média a alta (conforme tipo da resina). Rígida e frágil na versão padrão, porém extremamente fiel aos detalhes.",
    application: "Miniaturas de RPG/games super detalhadas, próteses odontológicas, moldes de joias de alta precisão.",
    colors: [
      { name: "Cinza Alta Precisão", hex: "#8e9297" },
      { name: "Transparente Cristal", hex: "#e2e8f0" },
      { name: "Preto Matte SLA", hex: "#111827" },
      { name: "Branco SLA", hex: "#f8fafc" }
    ]
  }
};

export default function FabMakersApp() {
  // false = esconde Designer, MakerWorld-hero, Shopee, AI (CONCEPT-MAP Later/Cut)
  const SHOW_LATER_UI = false;

  const router = useRouter();
  const pathname = usePathname() || "/";
  const boot = pathToAppState(pathname);

  const [activeTab, setActiveTab] = useState<AppTab>(boot.tab);
  
  // --- ESTADOS DE SESSÃO E AUTENTICAÇÃO REAL ---
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string; makerStatus?: string } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [homeMode, setHomeMode] = useState<HomeMode>(boot.homeMode);
  const [contratoAceito, setContratoAceito] = useState<boolean>(false);
  
  const [lojaInsumos, setLojaInsumos] = useState<Array<{ id: string; title: string; price: number; link: string; affiliateCommissionPercent: number; image: string; deliveryTime: string; platform: "SHOPEE" | "TIKTOK" | "AMAZON" | "ALIEXPRESS" }>>([
    { id: "ins1", title: "Filamento PLA Premium 1kg - GTMax3D", price: 119.90, link: "https://shopee.com.br/filamento-pla-gtmax", affiliateCommissionPercent: 5, image: "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?w=300&auto=format&fit=crop&q=60", deliveryTime: "3 a 7 dias úteis", platform: "SHOPEE" },
    { id: "ins2", title: "Bico Extrusor de Latão V6 0.4mm", price: 15.00, link: "https://shopee.com.br/bico-extrusor-latao-v6", affiliateCommissionPercent: 10, image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=60", deliveryTime: "2 a 5 dias úteis", platform: "TIKTOK" },
    { id: "ins3", title: "Resina Standard UV 1kg - Creality", price: 189.00, link: "https://shopee.com.br/resina-standard-uv-creality", affiliateCommissionPercent: 4, image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&auto=format&fit=crop&q=60", deliveryTime: "4 a 8 dias úteis", platform: "AMAZON" },
    { id: "ins4", title: "Bloco Aquecedor Volcano Alumínio", price: 29.90, link: "https://aliexpress.com/block-volcano", affiliateCommissionPercent: 8, image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&auto=format&fit=crop&q=60", deliveryTime: "12 a 20 dias úteis", platform: "ALIEXPRESS" }
  ]);
  const [novoInsumoTitle, setNovoInsumoTitle] = useState<string>("");
  const [novoInsumoPrice, setNovoInsumoPrice] = useState<string>("");
  const [novoInsumoLink, setNovoInsumoLink] = useState<string>("");
  const [novoInsumoCommission, setNovoInsumoCommission] = useState<string>("");
  const [novoInsumoImage, setNovoInsumoImage] = useState<string>("");
  const [novoInsumoDelivery, setNovoInsumoDelivery] = useState<string>("");
  const [novoInsumoPlatform, setNovoInsumoPlatform] = useState<"SHOPEE" | "TIKTOK" | "AMAZON" | "ALIEXPRESS">("SHOPEE");
  const [linkImportacao, setLinkImportacao] = useState<string>("");
  const [importandoLink, setImportandoLink] = useState<boolean>(false);
  
  // --- ESTADOS DO PORTAL DO DESIGNER ---
  const [designerAvailability, setDesignerAvailability] = useState<string>("20h por semana (Freelancer)");
  const [designerHourRate, setDesignerHourRate] = useState<number>(65);
  const [designerSpecialties, setDesignerSpecialties] = useState<string[]>(["Maquetes", "Personagens / Geek"]);
  const [designerPortfolio, setDesignerPortfolio] = useState<string>("");
  const [designerLegalAccepted, setDesignerLegalAccepted] = useState<boolean>(false);
  const [designerStatus, setDesignerStatus] = useState<"NONE" | "PENDING_APPROVAL" | "APPROVED">("NONE");
  
  // Obras Autorais do Designer Cadastrado
  const [designerObras, setDesignerObras] = useState<Array<{ id: string; title: string; category: string; description: string; price: number; image: string }>>([
    { id: "obra1", title: "Miniatura Guerreiro Bárbaro", category: "Miniaturas", description: "Escultura autoral de alta fantasia com suportes otimizados.", price: 45.00, image: "https://images.unsplash.com/photo-1608889175123-8ec330b86f84?w=300&auto=format&fit=crop&q=60" }
  ]);
  
  const [novaObraTitle, setNovaObraTitle] = useState<string>("");
  const [novaObraCategory, setNovaObraCategory] = useState<string>("Peças Técnicas");
  const [novaObraDescription, setNovaObraDescription] = useState<string>("");
  const [novaObraPrice, setNovaObraPrice] = useState<number>(30);
  const [novaObraImage, setNovaObraImage] = useState<string>("");

  // Lista fictícia global de designers na plataforma
  const [plataformaDesigners, setPlataformaDesigners] = useState<Array<{ id: string; name: string; email: string; availability: string; hourRate: number; specialties: string[]; portfolio: string; status: "PENDING_APPROVAL" | "APPROVED" }>>([
    { id: "des1", name: "Alan Turing 3D", email: "alan@fabmakers.com.br", availability: "40h por semana (Full-time)", hourRate: 90, specialties: ["Peças Técnicas", "Acessórios 3D"], portfolio: "Engenheiro de design mecânico. 5 anos modelando protótipos industriais no SolidWorks.", status: "APPROVED" },
    { id: "des2", name: "Beatriz Mota", email: "beatriz@fabmakers.com.br", availability: "10h por semana (Part-time)", hourRate: 50, specialties: ["Decoração", "Organização"], portfolio: "Designer de Interiores e modelista de adornos contemporâneos.", status: "APPROVED" },
    { id: "des3", name: "Clara Croft", email: "clara@fabmakers.com.br", availability: "15h por semana (Freelancer)", hourRate: 70, specialties: ["Brinquedos / Geek", "Miniaturas"], portfolio: "Artista de personagens autorais e Action Figures para RPG.", status: "PENDING_APPROVAL" }
  ]);

  // --- ESTADOS DA ÁREA DO CLIENTE EXPANDIDA ---
  const [clientSubTab, setClientSubTab] = useState<"upload" | "gallery" | "ai" | "orders">("upload");
  const [webSearchQuery, setWebSearchQuery] = useState<string>("");
  const [gallerySearchQuery, setGallerySearchQuery] = useState<string>("");
  const [galleryModels, setGalleryModels] = useState<any[]>([]);
  const [galleryLoading, setGalleryLoading] = useState<boolean>(false);
  const [selectedModelImage, setSelectedModelImage] = useState<string | null>(null);
  /** Catálogo curado (D006) — id do modelo; quote recalcula via API */
  const [curatedCatalogId, setCuratedCatalogId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [homeSearchQuery, setHomeSearchQuery] = useState<string>("");
  const [homeSearchLoading, setHomeSearchLoading] = useState<boolean>(false);
  const [selectedColor, setSelectedColor] = useState<string>("Preto Matte");
  const [isMultipart, setIsMultipart] = useState<boolean>(false);
  const [multipartColors, setMultipartColors] = useState<string[]>([]);
  const [extractingColors, setExtractingColors] = useState<boolean>(false);
  
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string; recommendedParams?: { filename: string; material: string; infill: number; weightG: number; timeFormatted: string; totalPrice: number } }>>([
    {
      role: "assistant",
      text: "Olá! Eu sou o FabMakers AI, seu assistente inteligente 3D. Me diga o que você precisa fabricar (ou descreva um objeto que viu na internet) e eu indicarei o modelo ideal, o melhor material (PLA, PETG, ABS) e as configurações ideais de preenchimento para cotação!"
    }
  ]);
  const [aiInputText, setAiInputText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [loginRole, setLoginRole] = useState<"CLIENT" | "MAKER" | "DESIGNER" | "MODERATOR" | "ADMIN">("MAKER");
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>("");
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [signupName, setSignupName] = useState<string>("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState<string>("");
  const uniqueBrands = Array.from(new Set(PRINTER_PRESETS.map(p => p.brand))).sort();

  // --- ESTADOS COMPARTILHADOS (SIMULAÇÃO DE BANCO DE DADOS) ---
  const [orders, setOrders] = useState<SimulatedOrder[]>([
    {
      id: "7842",
      filename: "suporte_trilho_cnc.stl",
      status: "COMPLETED",
      totalPrice: 48.50,
      weightG: 34.2,
      timeFormatted: "1h 45m",
      progress: 100,
      material: "PETG",
      zipCode: "13083-970",
      makerName: "Maria Souza",
      createdAt: "28/06/2026 10:14"
    },
    {
      id: "7843",
      filename: "engrenagem_cafeteira_reposicao.stl",
      status: "PRINTING",
      totalPrice: 13.88,
      weightG: 10.1,
      timeFormatted: "34 min",
      progress: 45,
      material: "PLA",
      zipCode: "01001-000",
      makerName: "Roberto Lima",
      createdAt: "28/06/2026 13:20"
    }
  ]);

  // Perfil do Maker (colaborador logado)
  const [makerProfile, setMakerProfile] = useState<MakerProfile | null>(null);

  // Lista de Makers no sistema (para visualização do Admin)
  const [systemMakers, setSystemMakers] = useState<MakerProfile[]>([
    {
      name: "Maria Souza",
      zipCode: "13083-970",
      rating: 4.9,
      penalties: 0,
      isBanned: false,
      isApproved: true,
      machines: [{ 
        id: "m1", 
        brand: "Bambu Lab", 
        model: "P1S", 
        nozzle: "0.4mm", 
        volume: "256x256x256mm",
        technology: "FDM",
        hasEnclosure: true,
        hasMulticolor: true,
        maxNozzleTemp: 300,
        maxBedTemp: 100,
        compatibleMaterials: ["PLA", "PETG", "ABS", "ASA", "TPU", "PC", "Nylon", "CF (Fibra de Carbono)"],
        supportedNozzles: ["0.2mm", "0.4mm", "0.6mm", "0.8mm"],
        typicalPrecision: 0.05,
        maxSpeed: 500,
        maxPartWeightG: 2000,
        releaseYear: 2023,
        status: "ACTIVE"
      }],
      filaments: [{ id: "f1", type: "PLA", color: "Preto", weightG: 850 }],
      availability: { 
        days: ["seg", "ter", "qua", "qui", "sex"], 
        shifts: ["tarde", "noite"], 
        months: ["todos"],
        dailyHours: { seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0, dom: 0 }
      },
      contractAccepted: true,
      kycStatus: "APPROVED",
      makerStatus: "HOMOLOGATED",
      kycDocumentUrl: "cnh_maria.jpg",
      kycSelfieUrl: "selfie_maria.jpg",
      calibX: 20.01,
      calibY: 19.99,
      calibZ: 20.00,
      calibImageUrl: "cubo_maria.jpg"
    },
    {
      name: "Roberto Lima",
      zipCode: "01001-000",
      rating: 4.2,
      penalties: 1,
      isBanned: false,
      isApproved: true,
      machines: [{ 
        id: "m2", 
        brand: "Creality", 
        model: "K1 Max", 
        nozzle: "0.6mm", 
        volume: "300x300x300mm",
        technology: "FDM",
        hasEnclosure: true,
        hasMulticolor: false,
        maxNozzleTemp: 300,
        maxBedTemp: 110,
        compatibleMaterials: ["PLA", "PETG", "ABS", "ASA", "TPU", "PC", "Nylon", "CF (Fibra de Carbono)"],
        supportedNozzles: ["0.2mm", "0.4mm", "0.6mm", "0.8mm"],
        typicalPrecision: 0.05,
        maxSpeed: 500,
        maxPartWeightG: 2000,
        releaseYear: 2023,
        status: "ACTIVE"
      }],
      filaments: [{ id: "f2", type: "PETG", color: "Cinza", weightG: 600 }],
      availability: { 
        days: ["seg", "qua", "sex", "sab"], 
        shifts: ["manha", "tarde"], 
        months: ["todos"],
        dailyHours: { seg: 6, ter: 0, qua: 6, qui: 0, sex: 6, sab: 6, dom: 0 }
      },
      contractAccepted: true,
      kycStatus: "APPROVED",
      makerStatus: "HOMOLOGATED",
      kycDocumentUrl: "rg_roberto.jpg",
      kycSelfieUrl: "selfie_roberto.jpg",
      calibX: 20.03,
      calibY: 19.96,
      calibZ: 20.02,
      calibImageUrl: "cubo_roberto.jpg"
    }
  ]);
 
  const [homologations, setHomologations] = useState<HomologationRequest[]>([
    {
      id: "req-1",
      name: "André Cruz",
      zipCode: "80010-000",
      machineModel: "Prusa i3 MK4",
      benchmarkResult: "PENDING",
      benchmarkImageUrl: "cubo_teste_andre.jpg",
      documentUrl: "rg_andre.jpg",
      selfieUrl: "selfie_andre.jpg",
      calibX: 20.08,
      calibY: 19.92,
      calibZ: 20.03,
      createdAt: "29/06/2026 10:14"
    },
    {
      id: "req-2",
      name: "Fernanda Dias",
      zipCode: "30110-000",
      machineModel: "Formlabs Form 4",
      benchmarkResult: "PENDING",
      benchmarkImageUrl: "peca_resina_fernanda.jpg",
      documentUrl: "cnh_fernanda.jpg",
      selfieUrl: "selfie_fernanda.jpg",
      calibX: 20.02,
      calibY: 19.98,
      calibZ: 20.01,
      createdAt: "29/06/2026 11:22"
    }
  ]);

  // Push notification simulado para o Maker (Roteamento Descentralizado)
  const [activeJobOffer, setActiveJobOffer] = useState<SimulatedOrder | null>(null);
  const [offerTimer, setOfferTimer] = useState<number>(30);

  /** Funil H5 — cadastro → homologado (admin) */
  const [h5Funnel, setH5Funnel] = useState<{
    started: number;
    homologated: number;
    conversionPct: number;
    counts: Record<string, number>;
  } | null>(null);

  // --- ESTADOS DO FATIADOR STL (Aba Cliente) ---
  const [file, setFile] = useState<File | null>(null);
  const [material, setMaterial] = useState<string>("PLA");
  const [infill, setInfill] = useState<number>(20);
  const [layerHeight, setLayerHeight] = useState<string>("0.20");
  const [infillPattern, setInfillPattern] = useState<string>("grid");
  const [loading, setLoading] = useState<boolean>(false);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados extras de proximidade do Cliente (ViaCEP + Radar)
  const [clientZip, setClientZip] = useState<string>("");
  const [clientAddress, setClientAddress] = useState<string>("");
  const [clientZipLoading, setClientZipLoading] = useState<boolean>(false);
  const [isScanningRadar, setIsScanningRadar] = useState<boolean>(false);
  const [nearbyMakers, setNearbyMakers] = useState<Array<{ name: string; distanceKm: number; etaMinutes: number; machine: string; rating: number }>>([]);

  // --- ESTADOS DE CADASTRO DO MAKER (WIZARD ETAPAS) ---
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [kycDocFront, setKycDocFront] = useState<string | null>(null);
  const [kycDocBack, setKycDocBack] = useState<string | null>(null);
  const [kycSelfie, setKycSelfie] = useState<string | null>(null);
  const [emailVerificationCode, setEmailVerificationCode] = useState<string>("");
  const [emailCodeSent, setEmailCodeSent] = useState<boolean>(false);
  const [emailVerifiedInWizard, setEmailVerifiedInWizard] = useState<boolean>(false);
  const [realGeneratedCode, setRealGeneratedCode] = useState<string>("");
  const [wizardName, setWizardName] = useState<string>("");
  const [wizardZip, setWizardZip] = useState<string>("");
  const [makerZipFeedback, setMakerZipFeedback] = useState<string>("");
  const [makerZipLoading, setMakerZipLoading] = useState<boolean>(false);
  const [wizardMachines, setWizardMachines] = useState<Machine[]>([
    { 
      id: "1", 
      brand: "Bambu Lab", 
      model: "P1S", 
      nozzle: "0.4mm", 
      volume: "256x256x256mm",
      technology: "FDM",
      hasEnclosure: true,
      hasMulticolor: true,
      maxNozzleTemp: 300,
      maxBedTemp: 100,
      compatibleMaterials: ["PLA", "PETG", "ABS", "ASA", "TPU", "PC", "Nylon", "CF (Fibra de Carbono)"],
      supportedNozzles: ["0.2mm", "0.4mm", "0.6mm", "0.8mm"],
      typicalPrecision: 0.05,
      maxSpeed: 500,
      maxPartWeightG: 2000,
      releaseYear: 2023,
      status: "ACTIVE"
    }
  ]);
  const [wizardFilaments, setWizardFilaments] = useState<Filament[]>([
    { id: "1", type: "PLA", color: "Preto", weightG: 1000 }
  ]);
  const [wizardDays, setWizardDays] = useState<string[]>(["seg", "ter", "qua", "qui", "sex"]);
  const [wizardShifts, setWizardShifts] = useState<string[]>(["tarde", "noite"]);
  const [wizardDailyHours, setWizardDailyHours] = useState<Record<string, number>>({
    seg: 8, ter: 8, qua: 8, qui: 8, sex: 8, sab: 0, dom: 0
  });

  // Estados para Onboarding de Segurança, Confirmação de E-mail Zoho e Contrato SLA
  const [wizardEmail, setWizardEmail] = useState<string>("");
  const [wizardPassword, setWizardPassword] = useState<string>("");
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const [emailVerificationLoading, setEmailVerificationLoading] = useState<boolean>(false);
  const [contractAccepted, setContractAccepted] = useState<boolean>(false);
  const [kycDocumentName, setKycDocumentName] = useState<string>("");
  const [kycSelfieName, setKycSelfieName] = useState<string>("");
  const [calibX, setCalibX] = useState<number>(20.00);
  const [calibY, setCalibY] = useState<number>(20.00);
  const [calibZ, setCalibZ] = useState<number>(20.00);
  const [calibImageName, setCalibImageName] = useState<string>("");
  /** Erros de validação do wizard (chave → mensagem); UI destaca o campo */
  const [wizardErrors, setWizardErrors] = useState<Record<string, string>>({});
  const wizardErrorBannerRef = useRef<HTMLDivElement | null>(null);

  // Sincroniza <html> com o tema (tokens CSS + Material Symbols no documento)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  // Autopreenchimento de email/nome do Wizard a partir do usuário logado
  useEffect(() => {
    if (currentUser) {
      setWizardEmail(currentUser.email);
      if (currentUser.name) setWizardName((prev) => prev || currentUser.name);
    }
  }, [currentUser]);


  // --- LÓGICA DE PERSISTÊNCIA EM BANCO DE DADOS REAL ---
  const refreshOrdersFromApi = () => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.orders) {
          setOrders((prev) => {
            const byId = new Map(prev.map((o) => [o.id, o]));
            for (const o of data.orders) {
              byId.set(o.id, { ...byId.get(o.id), ...o });
            }
            return Array.from(byId.values());
          });
        }
      })
      .catch((err) => console.error("Erro ao carregar ordens do banco:", err));
  };

  /** Layer B: navega aba + URL sem remountar o shell (layout estável). */
  const goTo = useCallback(
    (tab: AppTab, mode?: HomeMode) => {
      const resolvedMode: HomeMode =
        mode ?? (tab === "client" ? "client" : homeMode);
      setActiveTab(tab);
      if (mode !== undefined) setHomeMode(mode);
      else if (tab === "client") setHomeMode("client");
      const nextPath = appStateToPath(tab, resolvedMode);
      if (pathname !== nextPath) router.push(nextPath);
    },
    [homeMode, pathname, router]
  );

  useEffect(() => {
    const next = pathToAppState(pathname);
    setActiveTab((prev) => (prev === next.tab ? prev : next.tab));
    setHomeMode((prev) => (prev === next.homeMode ? prev : next.homeMode));
  }, [pathname]);

  // Restaura sessão após refresh (gate /admin e portal maker)
  useEffect(() => {
    const s = loadSession();
    if (!s?.user) return;
    setCurrentUser(s.user);
    if (s.makerProfile && typeof s.makerProfile === "object") {
      setMakerProfile(s.makerProfile as MakerProfile);
    }
  }, []);

  useEffect(() => {
    saveSession(currentUser, makerProfile);
  }, [currentUser, makerProfile]);

  // Deep-link /admin sem ADMIN → abre login admin (não mostra painel)
  useEffect(() => {
    if (activeTab !== "admin") return;
    if (currentUser?.role === "ADMIN") return;
    setLoginRole("ADMIN");
    setLoginEmail("");
    setLoginPassword("");
    setLoginError("");
    setShowLoginModal(true);
  }, [activeTab, currentUser?.role]);

  // Deep-link /maker com outro role → login maker; sessão maker sem token → re-login (D011/D012)
  useEffect(() => {
    if (activeTab !== "maker") return;
    if (currentUser && currentUser.role !== "MAKER") {
      setLoginRole("MAKER");
      setLoginEmail("");
      setLoginPassword("");
      setLoginError("");
      setShowLoginModal(true);
      return;
    }
    if (currentUser?.role === "MAKER" && !getMakerToken()) {
      setLoginRole("MAKER");
      setLoginEmail(currentUser.email || "");
      setLoginPassword("");
      setLoginError("Sessão expirada — entre de novo para aceitar jobs.");
      setShowLoginModal(true);
    }
  }, [activeTab, currentUser?.role, currentUser?.email]);

  useEffect(() => {
    // 1. Carrega makers do banco de dados
    fetch("/api/maker")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.makers) {
          setSystemMakers(prev => {
            const existingNames = new Set(prev.map(m => m.name));
            const newMakers = data.makers.filter((m: any) => !existingNames.has(m.name));
            return [...prev, ...newMakers];
          });
        }
      })
      .catch(err => console.error("Erro ao carregar makers do banco:", err));

    // 2. Carrega ordens do banco de dados
    refreshOrdersFromApi();

    // 3. Carrega homologações (só com token admin — D009)
    fetch("/api/admin", { headers: { ...adminAuthHeaders() } })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.homologations) {
          setHomologations((prev) => {
            const existingNames = new Set(prev.map((h) => h.name));
            const newHomologations = data.homologations.filter(
              (h: { name: string }) => !existingNames.has(h.name)
            );
            return [...prev, ...newHomologations];
          });
        }
      })
      .catch((err) => console.error("Erro ao carregar homologações do banco:", err));
  }, []);

  // Atualiza fila enquanto o maker está no painel (Supply-first) — queue autenticada (D015)
  useEffect(() => {
    if (activeTab !== "maker" || !makerProfile?.isApproved) return;
    const pull = () => {
      refreshOrdersFromApi();
      const headers = { ...makerAuthHeaders() };
      if (!getMakerToken()) return;
      fetch("/api/orders?filter=queue", { headers })
        .then((r) => r.json())
        .then((data) => {
          if (!data.success || !data.orders) return;
          setOrders((prev) => {
            const byId = new Map(prev.map((o) => [o.id, o]));
            for (const o of data.orders) byId.set(o.id, { ...byId.get(o.id), ...o });
            return Array.from(byId.values());
          });
        })
        .catch((err) => console.error("Erro ao carregar fila autenticada:", err));
    };
    pull();
    const t = setInterval(pull, 12000);
    return () => clearInterval(t);
  }, [activeTab, makerProfile?.isApproved]);

  // Funil H5 + homologações no admin (requer Bearer adminToken)
  useEffect(() => {
    if (activeTab !== "admin") return;
    if (currentUser?.role !== "ADMIN") return;
    const headers = { ...adminAuthHeaders() };
    fetch("/api/funnel/h5", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.funnel) setH5Funnel(data.funnel);
      })
      .catch((err) => console.error("Erro ao carregar funil H5:", err));
    fetch("/api/admin", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.homologations) {
          setHomologations((prev) => {
            const byId = new Map(prev.map((h) => [h.id, h]));
            for (const h of data.homologations) byId.set(h.id, h);
            return Array.from(byId.values());
          });
        }
      })
      .catch((err) => console.error("Erro ao carregar homologações admin:", err));
  }, [activeTab, currentUser?.role]);

  // --- LÓGICA DE SIMULAÇÃO EM SEGUNDO PLANO ---
  
  // Simulação de Progresso de Impressão (só % — avanço de status é manual no motor Core)
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders(prevOrders => 
        prevOrders.map(order => {
          if (order.status === "PRINTING" && order.progress < 85) {
            return { ...order, progress: Math.min(85, order.progress + 5) };
          }
          return order;
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulação do Timer da Oferta de Despacho no Maker
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeJobOffer && offerTimer > 0) {
      timer = setTimeout(() => setOfferTimer(prev => prev - 1), 1000);
    } else if (activeJobOffer && offerTimer === 0) {
      // Perdeu o job por tempo
      setActiveJobOffer(null);
      // Volta o status do pedido para WAITING_MAKER
      setOrders(prev => 
        prev.map(o => o.id === activeJobOffer.id ? { ...o, status: "WAITING_MAKER", makerName: undefined } : o)
      );
      alert("Tempo expirado! O job foi repassado para outro Maker mais próximo.");
    }
    return () => clearTimeout(timer);
  }, [activeJobOffer, offerTimer]);

  // Se um pedido entra em WAITING_MAKER, e temos um Maker logado e aprovado, dispara a oferta sob demanda
  useEffect(() => {
    const pendingOrder = orders.find(o => o.status === "WAITING_MAKER");
    if (pendingOrder && makerProfile && makerProfile.isApproved && !makerProfile.isBanned && !activeJobOffer) {
      // Oferece o job ao Maker logado
      setActiveJobOffer(pendingOrder);
      setOfferTimer(30);
    }
  }, [orders, makerProfile, activeJobOffer]);

  // Carrega modelos MakerWorld só se Later UI estiver ligada (Park)
  useEffect(() => {
    if (!SHOW_LATER_UI) return;
    const loadInitialGallery = async () => {
      setGalleryLoading(true);
      try {
        const response = await fetch("/api/makerworld/search?keyword=featured");
        const data = await response.json();
        if (data.success && data.models) {
          setGalleryModels(data.models);
        }
      } catch (err) {
        console.error("Erro ao carregar modelos iniciais da galeria:", err);
      } finally {
        setGalleryLoading(false);
      }
    };
    loadInitialGallery();
  }, []);

  // --- FUNÇÕES DO CLIENTE (COTAÇÃO & COMPRA) ---
  const generateCatalogQuote = async (
    catalogId: string,
    selectedMaterial: string,
    selectedInfill: number,
    selectedLayerHeight: string = layerHeight,
    selectedInfillPattern: string = infillPattern
  ) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogId,
          material: selectedMaterial,
          infill: selectedInfill,
          layerHeight: selectedLayerHeight,
          infillPattern: selectedInfillPattern,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar cotação do catálogo.");
      }
      setQuote(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao cotar modelo do catálogo.";
      console.error(err);
      setError(message);
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const selectCuratedModel = (model: CuratedModel) => {
    setCuratedCatalogId(model.id);
    setSelectedModelImage(model.image);
    setFile(new File([new ArrayBuffer(8)], model.filename, { type: "application/sla" }));
    setMaterial(model.defaultMaterial);
    // CEP seed + radar cosmético (não bloqueia a fila real)
    setClientZip("01001-000");
    setClientAddress("Sé, São Paulo - SP");
    setNearbyMakers([
      { name: "Maria Souza", distanceKm: 2.3, etaMinutes: 9, machine: "Bambu Lab P1S", rating: 4.9 },
      { name: "Roberto Lima", distanceKm: 5.7, etaMinutes: 18, machine: "Creality K1 Max", rating: 4.2 },
    ]);
    void generateCatalogQuote(model.id, model.defaultMaterial, infill, layerHeight, infillPattern);
    if (currentUser) {
      setClientSubTab("upload");
      goTo("client");
    } else {
      setLoginRole("CLIENT");
      setLoginEmail("");
      setLoginPassword("");
      setLoginError("");
      setShowLoginModal(true);
    }
  };

  const generateQuote = async (
    uploadedFile: File,
    selectedMaterial: string,
    selectedInfill: number,
    selectedLayerHeight: string = layerHeight,
    selectedInfillPattern: string = infillPattern
  ) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", uploadedFile);
    formData.append("material", selectedMaterial);
    formData.append("infill", selectedInfill.toString());
    formData.append("layerHeight", selectedLayerHeight);
    formData.append("infillPattern", selectedInfillPattern);

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao processar cotação.");
      }

      setQuote(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro ao analisar seu arquivo.");
      setQuote(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshQuoteParams = (
    nextMaterial: string,
    nextInfill: number,
    nextLayer: string,
    nextPattern: string
  ) => {
    if (curatedCatalogId) {
      void generateCatalogQuote(curatedCatalogId, nextMaterial, nextInfill, nextLayer, nextPattern);
      return;
    }
    if (file && file.size > 0) {
      void generateQuote(file, nextMaterial, nextInfill, nextLayer, nextPattern);
    }
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith(".stl")) {
        setSelectedModelImage(null);
        setCuratedCatalogId(null);
        setFile(droppedFile);
        generateQuote(droppedFile, material, infill);
      } else {
        setError("Apenas arquivos no formato .STL são suportados no momento.");
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setSelectedModelImage(null);
      setCuratedCatalogId(null);
      setFile(selectedFile);
      generateQuote(selectedFile, material, infill);
    }
  };

  const handleMaterialChange = (newMaterial: string) => {
    setMaterial(newMaterial);
    const details = materialDetails[newMaterial as keyof typeof materialDetails];
    if (details && details.colors && details.colors.length > 0) {
      setSelectedColor(details.colors[0].name);
    }
    refreshQuoteParams(newMaterial, infill, layerHeight, infillPattern);
  };

  const handleSimulateExample = () => {
    const demo = CURATED_CATALOG.find((m) => m.id === "fm-gear-spare") || CURATED_CATALOG[0];
    selectCuratedModel(demo);
  };

  const handleClear = () => {
    setFile(null);
    setQuote(null);
    setError(null);
    setSelectedModelImage(null);
    setCuratedCatalogId(null);
  };

  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleInfillChange = (newInfill: number) => {
    setInfill(newInfill);
    refreshQuoteParams(material, newInfill, layerHeight, infillPattern);
  };

  const handleLayerHeightChange = (newLayer: string) => {
    setLayerHeight(newLayer);
    refreshQuoteParams(material, infill, newLayer, infillPattern);
  };

  const handleInfillPatternChange = (newPattern: string) => {
    setInfillPattern(newPattern);
    refreshQuoteParams(material, infill, layerHeight, newPattern);
  };

  // --- FUNÇÕES DE CEP E GEOLOCALIZAÇÃO (ViaCEP) ---
  const handleClientZipChange = async (val: string) => {
    setClientZip(val);
    const cleanZip = val.replace(/\D/g, "");
    if (cleanZip.length === 8) {
      setClientZipLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setClientAddress(`${data.bairro}, ${data.localidade} - ${data.uf}`);
          setIsScanningRadar(true);
          setNearbyMakers([]);
          
          setTimeout(() => {
            setIsScanningRadar(false);
            const simulated = [
              { name: "Maria Souza", distanceKm: 2.3, etaMinutes: 9, machine: "Bambu Lab P1S", rating: 4.9 },
              { name: "Roberto Lima", distanceKm: 5.7, etaMinutes: 18, machine: "Creality K1 Max", rating: 4.2 }
            ];
            
            // Adiciona o próprio maker logado se ativo
            if (makerProfile && makerProfile.isApproved && !makerProfile.isBanned) {
              simulated.push({
                name: `${makerProfile.name} (Você)`,
                distanceKm: 0.8,
                etaMinutes: 4,
                machine: (makerProfile.machines[0]?.brand + " " + makerProfile.machines[0]?.model) || "FDM Standard",
                rating: makerProfile.rating
              });
            }
            setNearbyMakers(simulated.sort((a, b) => a.distanceKm - b.distanceKm));
          }, 1800);
        } else {
          setClientAddress("CEP não encontrado.");
          setNearbyMakers([]);
        }
      } catch (err) {
        setClientAddress("Erro ao buscar endereço.");
      } finally {
        setClientZipLoading(false);
      }
    } else {
      setClientAddress("");
      setNearbyMakers([]);
    }
  };

  const handleMakerZipChange = async (val: string) => {
    setWizardZip(val);
    const cleanZip = val.replace(/\D/g, "");
    if (cleanZip.length === 8) {
      setMakerZipLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanZip}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setMakerZipFeedback(`${data.bairro}, ${data.localidade} - ${data.uf}`);
        } else {
          setMakerZipFeedback("CEP não encontrado.");
        }
      } catch (err) {
        setMakerZipFeedback("Erro ao buscar endereço.");
      } finally {
        setMakerZipLoading(false);
      }
    } else {
      setMakerZipFeedback("");
    }
  };

  // Enviar ordem para fabricação local
  const dispatchOrder = () => {
    if (!currentUser) {
      setLoginRole("CLIENT");
      setLoginEmail("");
      setLoginPassword("");
      setLoginError("");
      setShowLoginModal(true);
      alert("Para confirmar o seu pedido e rotear a manufatura para os fabricantes locais, por favor faça login ou cadastre-se na plataforma.");
      return;
    }
    if (!quote) return;
    if (!clientZip || clientZip.replace(/\D/g, "").length !== 8) {
      alert("Por favor, informe um CEP válido para cotação de frete e roteamento.");
      return;
    }
    
    // Galeria MakerWorld (Later) usa .3mf; catálogo curado e upload STL mantêm o filename da cotação
    const finalFilename =
      selectedModelImage && !curatedCatalogId
        ? quote.filename.replace(/\.stl$/i, ".3mf")
        : quote.filename;

    const newOrder: SimulatedOrder = {
      id: Math.floor(1000 + Math.random() * 9000).toString(),
      filename: finalFilename,
      status: "WAITING_MAKER",
      totalPrice: quote.pricing.totalPrice,
      weightG: quote.metrics.weightG,
      timeFormatted: quote.metrics.timeFormatted,
      progress: 0,
      material: material,
      zipCode: clientZip,
      infill: infill,
      createdAt: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      makerPayout: quote.pricing.makerPayout,
      platformFee: quote.pricing.platformFee,
      catalogId: curatedCatalogId || null,
    };

    setOrders(prev => [newOrder, ...prev]);

    // Persistência real no banco de dados
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newOrder)
    }).catch(err => console.error("Erro ao salvar ordem no banco:", err));

    handleClear();
    setClientZip("");
    setClientAddress("");
    setNearbyMakers([]);
    alert(`Pedido #${newOrder.id} enviado para a fila WAITING_MAKER. Fabs homologadas podem aceitar o job.`);
  };

  // --- FUNÇÕES DO MAKER (WIZARD & DESPACHO SOB DEMANDA) ---
  
  // Concluir cadastro do Maker (Envia solicitação para aprovação do Admin)
  const handleRegisterMaker = async () => {
    const name = (wizardName || currentUser?.name || "").trim();
    const zip = wizardZip.trim();
    const email = (wizardEmail || currentUser?.email || "").trim();

    const errors: Record<string, string> = {};
    if (!emailVerified) errors.email = "Confirme o e-mail da sessão (passo 1).";
    if (!contractAccepted) errors.contract = "Aceite o contrato SLA (passo 2).";
    if (!name) errors.name = "Informe o nome completo (passo 1).";
    if (!zip || zip.replace(/\D/g, "").length < 8) errors.zip = "Informe um CEP válido com 8 dígitos (passo 1).";
    if (wizardMachines.length === 0) errors.machines = "Cadastre ao menos uma impressora (passo 3).";
    if (wizardFilaments.length === 0) errors.filaments = "Cadastre ao menos um filamento (passo 4).";
    if (!kycDocumentName) errors.kycDoc = "Anexe o documento de identidade.";
    if (!kycSelfieName) errors.kycSelfie = "Anexe a selfie com o documento.";
    if (!calibImageName) errors.calibPhoto = "Anexe a foto da medição do cubo.";
    if (!email) errors.emailSession = "E-mail da sessão não encontrado — faça login de novo.";

    if (Object.keys(errors).length > 0) {
      setWizardErrors(errors);
      const needsStep1 = !!(errors.email || errors.name || errors.zip || errors.emailSession);
      const needsStep2 = !!errors.contract;
      const needsStep3 = !!errors.machines;
      const needsStep4 = !!errors.filaments;
      if (needsStep1) setWizardStep(1);
      else if (needsStep2) setWizardStep(2);
      else if (needsStep3) setWizardStep(3);
      else if (needsStep4) setWizardStep(4);
      else setWizardStep(5);
      setTimeout(() => {
        wizardErrorBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    setWizardErrors({});
    if (!wizardName) setWizardName(name);

    const newProfile: MakerProfile = {
      name,
      zipCode: zip,
      rating: 5.0,
      penalties: 0,
      isBanned: false,
      isApproved: false,
      machines: wizardMachines,
      filaments: wizardFilaments,
      availability: {
        days: wizardDays,
        shifts: wizardShifts,
        months: ["todos"],
        dailyHours: wizardDailyHours
      },
      contractAccepted: true,
      kycStatus: "PENDING",
      makerStatus: "PENDING_APPROVAL",
      kycDocumentUrl: kycDocumentName,
      kycSelfieUrl: kycSelfieName,
      calibX: calibX,
      calibY: calibY,
      calibZ: calibZ,
      calibImageUrl: calibImageName
    };

    try {
      const res = await fetch("/api/maker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          zipCode: zip,
          machines: wizardMachines,
          filaments: wizardFilaments,
          availability: {
            days: wizardDays,
            shifts: wizardShifts,
            months: ["todos"],
            dailyHours: wizardDailyHours
          },
          makerStatus: "PENDING_APPROVAL",
          contractAccepted: true,
          calibX,
          calibY,
          calibZ,
          calibImageUrl: calibImageName,
          kycDocumentName,
          kycSelfieName
        })
      });
      const data = await res.json();
      if (!data.success) {
        setWizardErrors({ submit: data.error || "Erro ao salvar no servidor." });
        return;
      }
    } catch (err) {
      console.error("Erro ao salvar perfil no banco:", err);
      setWizardErrors({ submit: "Erro de conexão ao salvar. Tente de novo." });
      return;
    }

    setMakerProfile(newProfile);

    const newRequest: HomologationRequest = {
      id: `req-${Math.floor(100 + Math.random() * 900)}`,
      name,
      zipCode: zip,
      machineModel: wizardMachines[0]?.model || "FDM Standard",
      benchmarkResult: "PENDING",
      benchmarkImageUrl: calibImageName,
      documentUrl: kycDocumentName,
      selfieUrl: kycSelfieName,
      calibX: calibX,
      calibY: calibY,
      calibZ: calibZ,
      createdAt: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };

    setHomologations(prev => [newRequest, ...prev]);
  };

  // Adicionar máquina no wizard
  const addMachine = () => {
    const newM: Machine = {
      id: Math.random().toString(),
      brand: "Bambu Lab",
      model: "A1 Mini",
      nozzle: "0.4mm",
      volume: "180x180x180mm",
      technology: "FDM",
      hasEnclosure: false,
      hasMulticolor: true,
      maxNozzleTemp: 300,
      maxBedTemp: 100,
      compatibleMaterials: ["PLA", "PETG", "TPU"],
      supportedNozzles: ["0.2mm", "0.4mm", "0.6mm", "0.8mm"],
      typicalPrecision: 0.05,
      maxSpeed: 500,
      maxPartWeightG: 2000,
      releaseYear: 2023,
      status: "ACTIVE"
    };
    setWizardMachines([...wizardMachines, newM]);
  };

  // Adicionar filamento no wizard
  const addFilament = () => {
    const newF: Filament = {
      id: Math.random().toString(),
      type: "PETG",
      color: "Laranja",
      weightG: 1000
    };
    setWizardFilaments([...wizardFilaments, newF]);
  };

  // Toggle dias de disponibilidade
  const toggleDay = (day: string) => {
    if (wizardDays.includes(day)) {
      setWizardDays(wizardDays.filter(d => d !== day));
    } else {
      setWizardDays([...wizardDays, day]);
    }
  };

  // Toggle turnos de disponibilidade
  const toggleShift = (shift: string) => {
    if (wizardShifts.includes(shift)) {
      setWizardShifts(wizardShifts.filter(s => s !== shift));
    } else {
      setWizardShifts([...wizardShifts, shift]);
    }
  };

  // --- MOTOR CORE: claim / advance / release (persiste em /api/orders PATCH) ---
  const persistOrderAction = async (
    action: "claim" | "advance" | "release",
    orderId: string,
    makerName?: string
  ) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...makerAuthHeaders() },
        body: JSON.stringify({ action, orderId, makerName }),
      });
      const data = await res.json();
      if (!data.success) {
        console.warn("Motor orders:", data.error);
        return data;
      }
      return data;
    } catch (err) {
      console.error("Erro no motor de pedidos:", err);
      return { success: false, error: String(err) };
    }
  };

  const claimOrder = async (orderId: string) => {
    if (!makerProfile) return;
    const makerName = makerProfile.name || currentUser?.name;
    if (!makerName) {
      alert("Sessão sem nome de maker. Faça login de novo.");
      return;
    }
    if (makerProfile.makerStatus === "PENDING_APPROVAL" || makerProfile.makerStatus === "UNVERIFIED") {
      alert("Sua conta ainda está em análise! Aguarde homologação antes de fabricar.");
      return;
    }
    if (makerProfile.isBanned) {
      alert("Conta banida — não é possível aceitar jobs.");
      return;
    }

    const localSnapshot = orders.find((o) => o.id === orderId);

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: "PRINTING" as const, makerName, progress: 15 }
          : o
      )
    );
    setActiveJobOffer(null);
    if (!makerProfile.name) {
      setMakerProfile({ ...makerProfile, name: makerName });
    }

    let data = await persistOrderAction("claim", orderId, makerName);
    if (!data.success && localSnapshot) {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...localSnapshot,
          status: "WAITING_MAKER",
          makerName: undefined,
        }),
      });
      data = await persistOrderAction("claim", orderId, makerName);
    }
    if (!data.success) {
      alert(data.error || "Não foi possível aceitar o job. Atualize a fila e tente de novo.");
      refreshOrdersFromApi();
      return;
    }
    alert(`Job #${orderId} aceito. Produza e avance o status até o pagamento.`);
  };

  const advanceOrder = async (orderId: string) => {
    const current = orders.find((o) => o.id === orderId);
    if (!current) return;

    const next =
      current.status === "PRINTING" ? "SHIPPED" : current.status === "SHIPPED" ? "COMPLETED" : null;
    if (!next) return;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: next,
              progress: next === "SHIPPED" ? 90 : 100,
            }
          : o
      )
    );

    const data = await persistOrderAction("advance", orderId, makerProfile?.name);
    if (next === "COMPLETED") {
      const payout = current.makerPayout ?? current.totalPrice * 0.95;
      alert(
        data?.order?.payoutReleased !== false
          ? `Entrega confirmada. Pagamento liberado: R$ ${payout.toFixed(2).replace(".", ",")} (job #${orderId}).`
          : `Job #${orderId} marcado como concluído.`
      );
    }
  };

  // Aceitar Job (oferta push)
  const acceptJob = () => {
    if (!activeJobOffer || !makerProfile) return;
    void claimOrder(activeJobOffer.id);
  };

  // Rejeitar Job (Roteamento P2P)
  const rejectJob = () => {
    if (!activeJobOffer) return;
    setActiveJobOffer(null);
    setOrders((prev) =>
      prev.map((o) => (o.id === activeJobOffer.id ? { ...o, status: "WAITING_MAKER" as const } : o))
    );
  };

  // Desistir do Job ativo (Penalização + release na fila)
  const cancelActiveJob = (orderId: string) => {
    if (!makerProfile) return;

    const currentPenalties = makerProfile.penalties + 1;
    const nextRating = Math.max(1.0, parseFloat((makerProfile.rating - 0.5).toFixed(1)));
    const shouldBan = currentPenalties >= 3 || nextRating < 4.0;

    const updatedProfile = {
      ...makerProfile,
      penalties: currentPenalties,
      rating: nextRating,
      isBanned: shouldBan,
    };

    setMakerProfile(updatedProfile);
    setSystemMakers((prev) =>
      prev.map((m) => (m.name === makerProfile.name ? updatedProfile : m))
    );

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: "WAITING_MAKER" as const, makerName: undefined, progress: 0 } : o
      )
    );
    void persistOrderAction("release", orderId, makerProfile.name);

    if (shouldBan) {
      alert(
        "ALERTA DE SEGURANÇA: Você acumulou excesso de penalidades ou reputação insatisfatória e foi BANIDO da comunidade FAB MAKERS."
      );
    } else {
      alert(
        `Job cancelado. Penalidade aplicada: Reputação caiu para ${nextRating}★ (Penalidades: ${currentPenalties}/3).`
      );
    }
  };

  // --- FUNÇÕES DO ADMINISTRADOR ---
  
  // Homologar Maker (Aprovar cadastro)
  const approveMakerRequest = (reqId: string, name: string) => {
    setHomologations(prev => 
      prev.map(r => r.id === reqId ? { ...r, benchmarkResult: "APPROVED" } : r)
    );
    
    // Se o maker homologado for o maker logado, atualiza o status dele para aprovado
    if (makerProfile && makerProfile.name === name) {
      const updated = { ...makerProfile, isApproved: true, makerStatus: "SANDBOX" as const };
      setMakerProfile(updated);
      setSystemMakers(prev => [...prev, updated]);
    } else {
      // Adiciona na lista geral de aprovados
      setSystemMakers(prev => 
        prev.map(m => m.name === name ? { ...m, isApproved: true, makerStatus: "SANDBOX" as const } : m)
      );
    }

    // Persistência real no banco de dados
    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
      body: JSON.stringify({ action: "APPROVE", name })
    }).catch(err => console.error("Erro ao aprovar homologação no banco:", err));

    alert(`Maker ${name} homologado com sucesso! Agora está habilitado para receber cotações do Grid no período de Sandbox.`);
  };

  // Rejeitar Maker (Cubo fora da tolerância ou KYC inconsistente)
  const rejectMakerRequest = (reqId: string, name: string) => {
    setHomologations(prev => 
      prev.map(r => r.id === reqId ? { ...r, benchmarkResult: "REJECTED" } : r)
    );
    
    if (makerProfile && makerProfile.name === name) {
      setMakerProfile({
        ...makerProfile,
        isApproved: false,
        makerStatus: "UNVERIFIED"
      });
    } else {
      setSystemMakers(prev => 
        prev.map(m => m.name === name ? { ...m, isApproved: false, makerStatus: "UNVERIFIED" as const } : m)
      );
    }

    // Persistência real no banco de dados
    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
      body: JSON.stringify({ action: "REJECT", name })
    }).catch(err => console.error("Erro ao rejeitar homologação no banco:", err));

    alert(`Homologação do Maker ${name} rejeitada. O status foi resetado para permitir reenvio.`);
  };

  // Banir / Desbanir Maker manualmente
  const toggleBanMaker = (name: string) => {
    let nextBanned = false;
    setSystemMakers(prev => 
      prev.map(m => {
        if (m.name === name) {
          nextBanned = !m.isBanned;
          if (makerProfile && makerProfile.name === name) {
            setMakerProfile({ ...makerProfile, isBanned: nextBanned });
          }
          return { ...m, isBanned: nextBanned, penalties: nextBanned ? 3 : 0, rating: nextBanned ? 3.0 : 5.0 };
        }
        return m;
      })
    );

    // Persistência real no banco de dados
    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
      body: JSON.stringify({ action: nextBanned ? "BAN" : "UNBAN", name })
    }).catch(err => console.error("Erro ao alterar banimento no banco:", err));
  };

  // Busca dinâmica integrada na Galeria da área logada
  const handleGallerySearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gallerySearchQuery.trim()) return;
    setGalleryLoading(true);
    setCurrentPage(1); // Reseta a paginação ao fazer uma nova busca
    
    try {
      const response = await fetch(`/api/makerworld/search?keyword=${encodeURIComponent(gallerySearchQuery)}`);
      const data = await response.json();
      
      if (data.success && data.models) {
        setGalleryModels(data.models);
      } else {
        alert("Erro ao buscar modelos na galeria: " + (data.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      console.error("Erro na busca da galeria:", err);
      alert("Falha de conexão ao buscar modelos.");
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleCategorySearch = async (keyword: string) => {
    setGallerySearchQuery(keyword === "featured" ? "" : keyword);
    setGalleryLoading(true);
    try {
      const response = await fetch(`/api/makerworld/search?keyword=${encodeURIComponent(keyword)}`);
      const data = await response.json();
      if (data.success && data.models) {
        setGalleryModels(data.models);
      }
    } catch (err) {
      console.error("Erro na busca de categoria:", err);
    } finally {
      setGalleryLoading(false);
    }
  };

  // Busca dinâmica integrada na Landing Page pública
  const handleHomeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeSearchQuery.trim()) return;
    setHomeSearchLoading(true);
    setCurrentPage(1); // Reseta a paginação ao fazer uma nova busca
    
    try {
      const response = await fetch(`/api/makerworld/search?keyword=${encodeURIComponent(homeSearchQuery)}`);
      const data = await response.json();
      
      if (data.success && data.models) {
        setGalleryModels(data.models);
      } else {
        alert("Erro ao buscar modelos na página inicial: " + (data.error || "Erro desconhecido"));
      }
    } catch (err: any) {
      console.error("Erro na busca da home:", err);
      alert("Falha de conexão ao buscar modelos.");
    } finally {
      setHomeSearchLoading(false);
    }
  };

  // Simula a extração de cores por Inteligência Artificial baseado na imagem do modelo
  const handleExtractColorsFromImage = () => {
    if (!selectedModelImage) {
      alert("Por favor, selecione um modelo da galeria primeiro para analisar as cores por IA.");
      return;
    }
    setExtractingColors(true);
    setTimeout(() => {
      let extractedColors: string[] = [];
      const imgLower = selectedModelImage.toLowerCase();
      
      if (imgLower.includes("photo-1546435") || imgLower.includes("fone") || imgLower.includes("headphone")) {
        extractedColors = ["Vermelho Rubi", "Preto Matte"];
      } else if (imgLower.includes("photo-160008") || imgLower.includes("gaveta") || imgLower.includes("organizador")) {
        extractedColors = ["Laranja Neon", "Cinza Espacial"];
      } else if (imgLower.includes("photo-157850") || imgLower.includes("vaso")) {
        extractedColors = ["Vermelho Rubi", "Branco Neve"];
      } else if (imgLower.includes("photo-148596") || imgLower.includes("gancho") || imgLower.includes("bike")) {
        extractedColors = ["Preto Industrial", "Laranja Neon"];
      } else if (imgLower.includes("photo-156094") || imgLower.includes("action")) {
        extractedColors = ["Azul Cobalto", "Laranja Neon", "Preto Matte"];
      } else {
        extractedColors = ["Cinza Espacial", "Azul Cobalto"];
      }

      setMultipartColors(extractedColors);
      setIsMultipart(true);
      setExtractingColors(false);
      
      // Quando é multipartes, muda o nome final para incluir 'colorido_multipartes' para o Maker saber
      alert(`[FabMakers Vision AI] Análise visual concluída com sucesso!\nCores detectadas na imagem: ${extractedColors.join(", ")}.\nO modo multipartes foi habilitado automaticamente.`);
    }, 1500);
  };

  // Enviar mensagem para o Assistente de IA 3D ("FabMakers AI")
  const handleSendMessageToAI = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;

    const userText = aiInputText;
    setAiChatMessages(prev => [...prev, { role: "user", text: userText }]);
    setAiInputText("");
    setAiLoading(true);

    setTimeout(() => {
      let aiResponseText = "";
      let recommendedParams = undefined;

      const txt = userText.toLowerCase();

      if (txt.includes("fone") || txt.includes("headset")) {
        aiResponseText = "Excelente ideia! Encontrei um 'Suporte de Fone Minimalista' ideal na nossa rede. Para suportes de fone, recomendo o material PLA (se for apenas repouso decorativo de mesa) ou PETG (se for um suporte fixado por parafusos sob a mesa, devido à flexibilidade). Sugiro 20% de preenchimento (infill) giroidal.";
        recommendedParams = {
          filename: "suporte_fone_ia_recom.stl",
          material: "PLA",
          infill: 20,
          weightG: 45.0,
          timeFormatted: "2h 15min",
          totalPrice: 32.50
        };
      } else if (txt.includes("xbox") || txt.includes("controle") || txt.includes("playstation") || txt.includes("ps5")) {
        aiResponseText = "Perfeito! Tenho o modelo perfeito para você: 'Suporte de Controle de Console'. Recomendo a fabricação em PLA por ter acabamento visual premium e excelente fidelidade de encaixe. Preenchimento de 15% a 20% é mais do que suficiente.";
        recommendedParams = {
          filename: "suporte_controle_console.stl",
          material: "PLA",
          infill: 15,
          weightG: 38.0,
          timeFormatted: "1h 50min",
          totalPrice: 28.90
        };
      } else if (txt.includes("gancho") || txt.includes("bicicleta") || txt.includes("suporte de parede") || txt.includes("peso") || txt.includes("resistente")) {
        aiResponseText = "Atenção: Como se trata de um suporte mecânico de alta carga (como gancho de bicicleta), recomendo fortemente o material PETG ou ABS. O PLA é muito quebradiço para cargas constantes. Recomendo 45% de infill (preenchimento) com padrão cúbico ou giroidal para garantir a segurança estrutural.";
        recommendedParams = {
          filename: "bike_wall_hook_reinforced.stl",
          material: "PETG",
          infill: 45,
          weightG: 120.0,
          timeFormatted: "6h 10min",
          totalPrice: 85.00
        };
      } else {
        aiResponseText = "Compreendi seu projeto! Para a maioria das peças gerais e decorativas, recomendo o material PLA Preto ou PLA Cinza pela excelente precisão estética e custo-benefício. Se for uma peça mecânica funcional exposta a calor ou atrito, o melhor é optar por PETG. Já montei uma proposta técnica média de cotação para você:";
        recommendedParams = {
          filename: "projeto_personalizado_ia.stl",
          material: "PLA",
          infill: 20,
          weightG: 30.0,
          timeFormatted: "1h 30min",
          totalPrice: 25.00
        };
      }

      setAiChatMessages(prev => [...prev, { 
        role: "assistant", 
        text: aiResponseText, 
        recommendedParams 
      }]);
      setAiLoading(false);
    }, 1500);
  };

  // Restaurar conta banida de teste
  const resetMakerTest = () => {
    if (!makerProfile) return;
    setMakerProfile({
      ...makerProfile,
      rating: 5.0,
      penalties: 0,
      isBanned: false
    });
  };

  // Realizar o login na plataforma
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          role: loginRole
        })
      });

      const data = await res.json();

      if (data.success && data.user) {
        setCurrentUser(data.user);
        setShowLoginModal(false);
        setLoginEmail("");
        setLoginPassword("");
        
        if (data.user.role === "CLIENT") {
          setClientSubTab("upload");
          goTo("client");
        } else if (data.user.role === "MAKER") {
          goTo("maker");
          if (data.user.profile) {
            setMakerProfile({
              ...data.user.profile,
              name: data.user.profile.name || data.user.name,
            });
          } else {
            setMakerProfile(null);
          }
          saveSession(data.user, data.user.profile || null, {
            makerToken: data.makerToken || null,
            adminToken: null,
          });
        } else if (data.user.role === "ADMIN") {
          saveSession(data.user, null, { adminToken: data.adminToken || null, makerToken: null });
          goTo("admin");
        } else if (data.user.role === "DESIGNER") {
          setActiveTab("designer");
        } else if (data.user.role === "MODERATOR") {
          setActiveTab("moderator");
        }
      } else {
        setLoginError(data.error || "Erro ao realizar o login.");
      }
    } catch (err: any) {
      setLoginError("Erro de conexão com o servidor.");
      console.error(err);
    } finally {
      setLoginLoading(false);
    }
  };

  // Realizar o cadastro
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    
    if (loginPassword !== signupConfirmPassword) {
      setLoginError("As senhas não coincidem.");
      return;
    }
    
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName,
          email: loginEmail,
          password: loginPassword,
          role: loginRole
        })
      });
      
      const data = await res.json();
      
      if (data.success && data.user) {
        // Realiza o login imediato com a nova conta criada
        setCurrentUser(data.user);
        setShowLoginModal(false);
        setLoginEmail("");
        setLoginPassword("");
        setSignupName("");
        setSignupConfirmPassword("");
        setIsSignUp(false);
        
        if (data.user.role === "CLIENT") {
          goTo("client");
          alert("Cadastro de Cliente realizado com sucesso! Bem-vindo à FabMakers.");
        } else if (data.user.role === "MAKER") {
          goTo("maker");
          setMakerProfile(null); // Abre o formulário/wizard de onboarding para preenchimento
          alert("Cadastro de Maker realizado com sucesso! Preencha agora a calibração técnica e dados para homologação.");
        }
      } else {
        setLoginError(data.error || "Erro ao realizar o cadastro.");
      }
    } catch (err: any) {
      setLoginError("Erro de conexão com o servidor.");
      console.error(err);
    } finally {
      setLoginLoading(false);
    }
  };

  // Realizar o logout
  const handleLogout = () => {
    setCurrentUser(null);
    setMakerProfile(null);
    saveSession(null);
    goTo("home", "maker");
  };

  const openAdminLogin = () => {
    setLoginRole("ADMIN");
    setLoginEmail("");
    setLoginPassword("");
    setLoginError("");
    setShowLoginModal(true);
  };

  const openMakerLogin = () => {
    setLoginRole("MAKER");
    setLoginEmail("roda@fabmakers.com.br");
    setLoginPassword("");
    setLoginError("");
    setShowLoginModal(true);
  };

  return (
    <div className={`min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-[#d44d00]/30 selection:text-white transition-colors duration-300 ${theme}`}>
      
      {/* HEADER TÉCNICO - Minimalista, com logo PNG calibrado */}
      <header className={`sticky top-0 z-50 transition-colors duration-300 backdrop-blur-md ${
        theme === "light"
          ? "border-b border-[#ebebef]/80 bg-[#f5f5f7]/85"
          : "border-b border-[#18181b] bg-background"
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div 
              className="flex items-center cursor-pointer"
              onClick={() => {
                if (currentUser) {
                  if (currentUser.role === "CLIENT") goTo("client");
                  else if (currentUser.role === "MAKER") goTo("maker");
                  else if (currentUser.role === "ADMIN") goTo("admin");
                } else {
                  goTo("home", "maker");
                }
              }}
            >
              <Image 
                src={logoMark} 
                alt="FAB MAKERS" 
                className="logo-mark select-none transition-all duration-300"
                priority 
              />
            </div>

            {/* Perfil do usuário logado (exibido em vez das abas de navegação globais) */}
            {currentUser && (
              <div className="hidden md:flex items-center gap-2.5">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium tracking-wide ${
                  theme === "light"
                    ? "bg-[#f0f0f3] text-[#5c5c66]"
                    : "bg-[#18181b] border border-[#27272a] text-[#a1a1aa] uppercase mono-text text-[10px] tracking-wider font-bold"
                }`}>
                  {currentUser.role === "ADMIN" ? "ADMIN" : currentUser.role === "MAKER" ? "Maker Partner" : "Cliente"}
                </span>
                <span className={`text-xs ${theme === "light" ? "text-[#c4c4cc]" : "text-[#27272a]"}`}>|</span>
                <span className={`text-xs font-medium ${theme === "light" ? "text-[#6b6b73]" : "text-[#a1a1aa]"}`}>
                  Logado como: <span className={`font-semibold ${theme === "light" ? "text-[#111]" : "text-white"}`}>{currentUser.name}</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Alternador de Tema Híbrido (Light/Dark) */}
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className={`p-2 rounded-full transition cursor-pointer border ${
                theme === "dark"
                  ? "border-white/10 hover:bg-white/5 text-[#a1a1aa] hover:text-white"
                  : "border-[#e4e4ea] hover:bg-black/5 text-[#5c5c66] hover:text-[#111]"
              }`}
              title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
              aria-label={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
            >
              <Icon name={theme === "dark" ? "light_mode" : "dark_mode"} size={20} />
            </button>
            {!currentUser ? (
              <>
                <button
                  onClick={() => {
                    setLoginRole("MAKER");
                    setLoginEmail("");
                    setLoginPassword("");
                    setLoginError("");
                    setShowLoginModal(true);
                  }}
                  className="text-xs bg-[#d44d00] hover:bg-[#b04000] text-white px-4 py-2 font-medium transition rounded-md cursor-pointer"
                >
                  Entrar como Fab
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {currentUser.role === "ADMIN" && (
                  <a
                    href="/pitch_fabmakers.html"
                    target="_blank"
                    className={`hidden sm:inline-block text-xs font-medium px-4 py-2 transition rounded-md border ${
                      theme === "dark" 
                        ? "border-white/10 text-[#a1a1aa] hover:text-white hover:bg-white/5 bg-transparent" 
                        : "border-black/10 text-[#52525b] hover:text-black hover:bg-black/5 bg-transparent"
                    }`}
                  >
                    Apresentação & Pitch
                  </a>
                )}
                <button
                  onClick={handleLogout}
                  className="text-xs border border-red-500/20 text-red-400 hover:text-white hover:bg-red-500/20 px-4 py-2 font-medium transition rounded-md cursor-pointer"
                >
                  Sair (Logout)
                </button>
              </div>
            )}
          </div>
        </div>
        
      </header>

      {/* CONTEÚDO DINÂMICO DE ABAS */}
      <main className="flex-grow">

        {/* TAB 1: HOME (APRESENTAÇÃO CORPORATIVA E PORTAIS DE ACESSO) */}
        {activeTab === "home" && (
          <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
            
             {homeMode !== "select" && (
               <div className="flex justify-between items-center pb-4 border-b border-[#18181b]/30">
                 <button
                   onClick={() => setHomeMode("select")}
                   className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                     theme === "dark" ? "text-[#a1a1aa] hover:text-white" : "text-[#52525b] hover:text-black"
                   }`}
                 >
                   &larr; Visão geral
                 </button>
                 <div className={`rounded-lg p-1 flex gap-1 border ${
                   theme === "dark" ? "bg-[#09090b] border-[#18181b]" : "bg-[#f4f4f5] border-[#e4e4e7]"
                 }`}>
                   <button
                     onClick={() => goTo("home", "maker")}
                     className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                       homeMode === "maker" 
                         ? theme === "dark" ? "bg-white text-black" : "bg-black text-white" 
                         : theme === "dark" ? "text-[#a1a1aa] hover:text-white" : "text-[#52525b] hover:text-black"
                     }`}
                   >
                     Fab / Maker
                   </button>
                   <button
                     onClick={() => goTo("home", "client")}
                     className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                       homeMode === "client" 
                         ? theme === "dark" ? "bg-white text-black" : "bg-black text-white" 
                         : theme === "dark" ? "text-[#a1a1aa] hover:text-white" : "text-[#52525b] hover:text-black"
                     }`}
                   >
                     Seed demanda
                   </button>
                   {SHOW_LATER_UI && (
                   <button
                     onClick={() => setHomeMode("designer")}
                     className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                       homeMode === "designer" 
                         ? theme === "dark" ? "bg-white text-black" : "bg-black text-white" 
                         : theme === "dark" ? "text-[#a1a1aa] hover:text-white" : "text-[#52525b] hover:text-black"
                     }`}
                   >
                     Designer
                   </button>
                   )}
                 </div>
               </div>
             )}

             {/* TELA DE SELEÇÃO — Supply-first: fab em primeiro plano */}
             {homeMode === "select" && (
               <div className="py-12 space-y-10 text-center max-w-3xl mx-auto">
                 <div className="space-y-4">
                   <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d44d00] mono-text">FabMakers</p>
                   <h1 className={`text-4xl md:text-5xl font-black tracking-tight leading-none ${
                     theme === "dark" ? "text-white" : "text-black"
                   }`}>
                     Fabs homologadas pegam jobs da fila
                   </h1>
                   <p className={`text-sm md:text-base max-w-xl mx-auto ${
                     theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"
                   }`}>
                     Rede brasileira de impressão 3D sob demanda. Cadastre sua fab, aceite trabalhos pagos e produza com QA.
                   </p>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                   <button
                     onClick={() => {
                       if (currentUser?.role === "MAKER") {
                         goTo("maker");
                       } else if (currentUser) {
                         goTo("home", "maker");
                       } else {
                         setLoginRole("MAKER");
                         setLoginEmail("");
                         setLoginPassword("");
                         setLoginError("");
                         setShowLoginModal(true);
                       }
                     }}
                     className="px-8 py-3.5 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                   >
                     Quero produzir na rede
                   </button>
                   <button
                     onClick={() => goTo("home", "maker")}
                     className={`px-8 py-3.5 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer border ${
                       theme === "dark"
                         ? "border-white/15 text-white hover:bg-white/5"
                         : "border-black/15 text-black hover:bg-black/5"
                     }`}
                   >
                     Ver como funciona
                   </button>
                 </div>

                 <p className={`text-xs pt-4 ${theme === "dark" ? "text-[#71717a]" : "text-[#71717a]"}`}>
                   Precisa só alimentar a fila com um STL?{" "}
                   <button
                     type="button"
                     onClick={() => goTo("home", "client")}
                     className="text-[#d44d00] font-bold underline underline-offset-2 cursor-pointer"
                   >
                     Criar demanda seed
                   </button>
                 </p>
               </div>
             )}

            {/* MODO CLIENTE: VITRINE DE PROJETOS E PROPOSTAS STL */}
            {homeMode === "client" && (
              <div className="space-y-16">
                {/* Hero do Cliente */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-4">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d44d00]/10 border border-[#d44d00]/20 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d44d00] animate-pulse"></span>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#d44d00] mono-text">Impressão 3D Despachada Localmente</span>
                    </div>
                    <h1 className={`text-4xl md:text-6xl font-extrabold tracking-tighter leading-none ${
                      theme === "dark" ? "text-white" : "text-black"
                    }`}>
                      Não tem impressora? <br />
                      <span className="text-[#d44d00]">Nós fabricamos e entregamos para você.</span>
                    </h1>
                    <p className={`text-sm md:text-base leading-relaxed max-w-xl ${
                      theme === "dark" ? "text-[#a1a1aa]" : "text-[#4b5563]"
                    }`}>
                      Cote seu modelo 3D em segundos. Roteamos sua peça para a rede de makers locais (hobbistas e bureaus industriais). O primeiro fabricante disponível aceita a cotação e inicia a produção imediatamente. Intermediação digital segura sob demanda!
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                      <button
                        onClick={() => {
                          document.getElementById("catalogo-curado")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="px-6 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                      >
                        Ver catálogo e cotar
                      </button>
                      <button
                        onClick={() => {
                          if (currentUser) {
                            goTo("client");
                            setClientSubTab("upload");
                          } else {
                            setLoginRole("CLIENT");
                            setLoginEmail("");
                            setLoginPassword("");
                            setLoginError("");
                            setShowLoginModal(true);
                          }
                        }}
                        className={`px-6 py-3 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer border ${
                          theme === "dark" 
                            ? "border-white/15 text-white hover:bg-white/5 bg-transparent" 
                            : "border-black/15 text-black hover:bg-black/5 bg-transparent"
                        }`}
                      >
                        Enviar STL próprio
                      </button>
                      {!SHOW_LATER_UI && (
                      <button
                        onClick={() => goTo("home", "maker")}
                        className={`px-6 py-3 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer border ${
                          theme === "dark" 
                            ? "border-white/15 text-white hover:bg-white/5 bg-transparent" 
                            : "border-black/15 text-black hover:bg-black/5 bg-transparent"
                        }`}
                      >
                        Voltar ao portal da fab
                      </button>
                      )}
                      {SHOW_LATER_UI && (
                      <button
                        onClick={() => {
                          const element = document.getElementById("populares-makerworld");
                          if (element) element.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`px-6 py-3 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer border ${
                          theme === "dark" 
                            ? "border-white/15 text-white hover:bg-white/5 bg-transparent" 
                            : "border-black/15 text-black hover:bg-black/5 bg-transparent"
                        }`}
                      >
                        Ver Modelos Populares
                      </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className={`rounded-lg p-6 space-y-4 relative overflow-hidden border ${
                      theme === "dark" ? "bg-[#09090b] border-[#18181b]" : "bg-[#f4f4f5] border-[#e4e4e7]"
                    }`}>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#d44d00]/5 rounded-full blur-3xl"></div>
                      <h3 className={`text-xs font-bold uppercase tracking-wider mono-text border-b pb-2 ${
                        theme === "dark" ? "text-white border-[#18181b]" : "text-black border-[#e4e4e7]"
                      }`}>Como Funciona o Fluxo</h3>
                      <div className="space-y-4 text-xs">
                        <div className="flex gap-3">
                          <span className={`w-5 h-5 rounded font-bold flex items-center justify-center flex-shrink-0 border text-[10px] ${
                            theme === "dark" ? "bg-[#18181b] border-[#27272a] text-[#d44d00]" : "bg-[#e4e4e7] border-[#d4d4d8] text-[#d44d00]"
                          }`}>1</span>
                          <div>
                            <h4 className={`font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>Escolha ou Envie o Arquivo</h4>
                            <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>Importe da nossa galeria ou envie seu arquivo de engenharia STL.</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <span className={`w-5 h-5 rounded font-bold flex items-center justify-center flex-shrink-0 border text-[10px] ${
                            theme === "dark" ? "bg-[#18181b] border-[#27272a] text-[#d44d00]" : "bg-[#e4e4e7] border-[#d4d4d8] text-[#d44d00]"
                          }`}>2</span>
                          <div>
                            <h4 className={`font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>Orçamento Fatiado na Hora</h4>
                            <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>Calculamos peso, tempo de máquina e custo exato em 0.12 segundos.</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <span className={`w-5 h-5 rounded font-bold flex items-center justify-center flex-shrink-0 border text-[10px] ${
                            theme === "dark" ? "bg-[#18181b] border-[#27272a] text-[#d44d00]" : "bg-[#e4e4e7] border-[#d4d4d8] text-[#d44d00]"
                          }`}>3</span>
                          <div>
                            <h4 className={`font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>Despacho sob Demanda</h4>
                            <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>Ao confirmar o pedido logado, a ordem vai para o radar geral e o primeiro maker local aceita e inicia a manufatura.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Catálogo curado (D006) — Support: demanda → orçamento → fila */}
                <div id="catalogo-curado" className={`space-y-6 pt-6 border-t ${theme === "dark" ? "border-[#18181b]/50" : "border-[#e4e4e7]"}`}>
                  <div>
                    <h2 className={`text-lg font-bold uppercase tracking-tight mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>
                      Catálogo FabMakers
                    </h2>
                    <p className={`text-xs mt-1 max-w-2xl ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#4b5563]"}`}>
                      Escolha um modelo, ajuste material e preenchimento, receba o orçamento e envie para a fila das fabs homologadas.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {CURATED_CATALOG.map((item) => (
                      <div
                        key={item.id}
                        className={`bg-transparent border rounded-lg overflow-hidden flex flex-col justify-between transition group hover:border-[#d44d00]/40 ${
                          theme === "dark" ? "border-[#18181b] hover:bg-[#18181b]/30" : "border-[#e4e4e7] hover:bg-[#f4f4f5]"
                        }`}
                      >
                        <div className={`aspect-video w-full relative overflow-hidden ${theme === "dark" ? "bg-[#18181b]" : "bg-[#f4f4f5]"}`}>
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                        </div>
                        <div className="p-4 flex-grow flex flex-col justify-between space-y-3">
                          <div>
                            <p className={`text-[10px] uppercase tracking-wider mb-1 ${theme === "dark" ? "text-[#71717a]" : "text-[#71717a]"}`}>
                              {item.category}
                            </p>
                            <h4 className={`font-bold text-xs leading-snug ${theme === "dark" ? "text-white" : "text-black"}`} title={item.title}>
                              {item.title}
                            </h4>
                            <p className={`text-xs mt-1 line-clamp-2 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>
                              {item.description}
                            </p>
                          </div>
                          <div className={`flex justify-between items-center pt-2 border-t ${theme === "dark" ? "border-[#18181b]/50" : "border-[#e4e4e7]"}`}>
                            <span className={`text-[10px] mono-text ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
                              {item.defaultMaterial}
                            </span>
                            <button
                              type="button"
                              onClick={() => selectCuratedModel(item)}
                              className="px-2.5 py-1 bg-[#d44d00] hover:bg-[#b04000] text-xs font-bold text-white uppercase rounded transition cursor-pointer"
                            >
                              Cotar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grid de Modelos Populares — Park (MakerWorld) */}
                {SHOW_LATER_UI && (
                <div id="populares-makerworld" className={`space-y-6 pt-6 border-t ${theme === "dark" ? "border-[#18181b]/50" : "border-[#e4e4e7]"}`}>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <h2 className={`text-lg font-bold uppercase tracking-tight mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>Ideias e Modelos Populares da Rede</h2>
                      <p className={`text-xs mt-1 ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#4b5563]"}`}>
                        Pesquise ou clique em qualquer modelo abaixo para importá-lo instantaneamente e receber seu orçamento físico.
                      </p>
                    </div>

                    {/* Barra de Pesquisa com Lupa na primeira página */}
                    <form onSubmit={handleHomeSearch} className="flex gap-2 w-full md:max-w-xs">
                      <div className="relative flex-grow">
                        <input
                          type="text"
                          placeholder="Buscar modelos na rede..."
                          value={homeSearchQuery}
                          onChange={(e) => setHomeSearchQuery(e.target.value)}
                          className={`w-full border rounded pl-10 pr-3 py-2 text-xs focus:outline-none focus:border-[#d44d00] transition ${
                            theme === "dark" ? "bg-[#09090b] border-[#18181b] text-white" : "bg-white border-[#d4d4d8] text-black"
                          }`}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-[#71717a]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={homeSearchLoading}
                        className="px-4 py-2 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer flex items-center gap-2"
                      >
                        {homeSearchLoading ? "Buscando..." : "Pesquisar"}
                      </button>
                    </form>
                  </div>

                  {homeSearchLoading ? (
                    <div className="py-12 text-center">
                      <div className="w-8 h-8 rounded-full border border-dashed border-[#71717a] border-t-[#d44d00] animate-spin mx-auto"></div>
                      <p className="text-xs text-[#71717a] mt-3">Pesquisando modelos na rede...</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {(() => {
                          const homeFallbackModels = [
                            { id: "mw1", title: "Suporte de Fone Minimalista", image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=300&auto=format&fit=crop&q=60", weightG: 45.0, author: "Bambu_User", source: "MakerWorld", stlName: "fone_minimalista.stl", price: 32.50, timeFormatted: "2h 15min" },
                            { id: "mw2", title: "Organizador Modular de Gavetas", image: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=300&auto=format&fit=crop&q=60", weightG: 68.0, author: "Print_Lab", source: "Printables", stlName: "gaveta_modular.stl", price: 44.90, timeFormatted: "1h 50min" },
                            { id: "mw3", title: "Vaso Espiral Geométrico", image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&auto=format&fit=crop&q=60", weightG: 55.0, author: "VaseDesign", source: "MakerWorld", stlName: "vaso_espiral.stl", price: 38.00, timeFormatted: "2h 45min" },
                            { id: "mw4", title: "Gancho de Bicicleta Reforçado", image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=300&auto=format&fit=crop&q=60", weightG: 120.0, author: "Tough3D", source: "MakerWorld", stlName: "gancho_bike.stl", price: 85.00, timeFormatted: "6h 10min" },
                            { id: "mw5", title: "Action Figure Articulada", image: "https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=300&auto=format&fit=crop&q=60", weightG: 32.0, author: "MiniArt", source: "Thingiverse", stlName: "action_figure.stl", price: 25.00, timeFormatted: "1h 30min" },
                            { id: "mw6", title: "Case Placa Raspberry Pi 4", image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&auto=format&fit=crop&q=60", weightG: 28.0, author: "PiMaker", source: "MakerWorld", stlName: "case_pi4.stl", price: 22.00, timeFormatted: "1h 10min" },
                            { id: "mw7", title: "Luminária de Mesa Art Déco", image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=300&auto=format&fit=crop&q=60", weightG: 110.0, author: "LuxDesign", source: "Printables", stlName: "luminaria_art_deco.stl", price: 78.00, timeFormatted: "5h 40min" },
                            { id: "mw8", title: "Adaptador de Mangueira Jardim", image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&auto=format&fit=crop&q=60", weightG: 42.0, author: "GardenTech", source: "Thingiverse", stlName: "adaptador_mangueira.stl", price: 35.00, timeFormatted: "2h 05min" },
                            { id: "mw9", title: "Presilha Organizadora de Cabos", image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=300&auto=format&fit=crop&q=60", weightG: 8.0, author: "WireOrganizer", source: "MakerWorld", stlName: "presilha_cabos.stl", price: 10.00, timeFormatted: "25min" },
                            { id: "mw10", title: "Suporte de Copo para Carro", image: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=300&auto=format&fit=crop&q=60", weightG: 50.0, author: "CarGadgets", source: "Printables", stlName: "suporte_copo_carro.stl", price: 38.00, timeFormatted: "2h 10min" },
                            { id: "mw11", title: "Engrenagem Mecânica de Reposição", image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=60", weightG: 15.0, author: "MechPart", source: "Thingiverse", stlName: "engrenagem_spur.stl", price: 28.00, timeFormatted: "50min" },
                            { id: "mw12", title: "Miniatura de Anatomia Humana", image: "https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?w=300&auto=format&fit=crop&q=60", weightG: 30.0, author: "Bio3D", source: "MakerWorld", stlName: "miniatura_anatomia.stl", price: 42.00, timeFormatted: "1h 45min" }
                          ];

                          const activeModels = galleryModels && galleryModels.length > 0
                            ? galleryModels.map(m => ({
                                id: m.id,
                                title: m.title,
                                image: m.image,
                                weightG: m.weightG,
                                author: m.author || "Bambu_User",
                                source: m.source,
                                stlName: m.stlName,
                                price: m.totalPrice,
                                timeFormatted: m.timeFormatted
                              }))
                            : homeFallbackModels;

                          const itemsPerPage = 12;
                          const totalPages = Math.ceil(activeModels.length / itemsPerPage);
                          const indexOfLastItem = currentPage * itemsPerPage;
                          const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                          const currentItems = activeModels.slice(indexOfFirstItem, indexOfLastItem);

                          return (
                            <>
                              {currentItems.map((item) => (
                                <div key={item.id} className={`bg-transparent border rounded-lg overflow-hidden flex flex-col justify-between transition group hover:border-[#d44d00]/40 ${
                                  theme === "dark" ? "border-[#18181b] hover:bg-[#18181b]/30" : "border-[#e4e4e7] hover:bg-[#f4f4f5]"
                                }`}>
                                  <div className="aspect-video w-full relative overflow-hidden bg-[#18181b]">
                                    <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                                  </div>
                                  <div className="p-4 flex-grow flex flex-col justify-between space-y-4">
                                    <div>
                                      <h4 className={`font-bold text-xs leading-snug truncate ${theme === "dark" ? "text-white" : "text-black"}`} title={item.title}>{item.title}</h4>
                                      <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>Criado por: {item.author}</p>
                                    </div>
                                    <div className={`flex justify-between items-center pt-2 border-t ${theme === "dark" ? "border-[#18181b]/50" : "border-[#e4e4e7]"}`}>
                                      <span className="text-xs font-bold text-[#d44d00] mono-text">R$ {item.price.toFixed(2)}</span>
                                      <button
                                        onClick={() => {
                                          // Injeta os dados da galeria no Quote
                                          setSelectedModelImage(item.image); // Leva a imagem do modelo para a cotação
                                          setFile(new File([new ArrayBuffer(100)], item.stlName, { type: "application/sla" }));
                                          setMaterial("PLA");
                                          setQuote({
                                            success: true,
                                            filename: item.stlName,
                                            trianglesCount: 15420,
                                            boundingBox: { width: 120, depth: 80, height: 160 },
                                            metrics: {
                                              rawVolumeMm3: item.weightG * 1000,
                                              realVolumeCm3: item.weightG / 1.2,
                                              weightG: item.weightG,
                                              timeHours: item.weightG / 18,
                                              timeFormatted: item.timeFormatted || "2h 15min"
                                            },
                                            pricing: {
                                              materialCost: item.weightG * 0.12,
                                              machineCost: (item.weightG / 18) * 12,
                                              makerProfit: (item.weightG * 0.12 + (item.weightG / 18) * 12) * 0.40,
                                              makerPayout: item.price * 0.95, // desconta 5% da plataforma
                                              platformFee: item.price * 0.05, // comissão 5%
                                              royaltyPrice: 0.0,
                                              totalPrice: item.price
                                            }
                                          });
                                          setClientZip("01001-000"); // CEP Padrão para facilitar
                                          if (currentUser) {
                                            goTo("client");
                                            setClientSubTab("upload");
                                          } else {
                                            setLoginRole("CLIENT");
                                            setLoginEmail("");
                                            setLoginPassword("");
                                            setLoginError("");
                                            setShowLoginModal(true);
                                          }
                                        }}
                                        className="px-2.5 py-1 bg-[#d44d00] hover:bg-[#b04000] text-xs font-bold text-white uppercase rounded transition cursor-pointer"
                                      >
                                        Imprimir Peça
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Paginador */}
                              {totalPages > 1 && (
                                <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex justify-center items-center gap-2 mt-8 pt-4 border-t border-[#18181b]/50">
                                  <button
                                    onClick={() => {
                                      setCurrentPage(prev => Math.max(prev - 1, 1));
                                      document.getElementById("populares-makerworld")?.scrollIntoView({ behavior: "smooth" });
                                    }}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer border ${
                                      currentPage === 1
                                        ? "border-[#18181b] text-[#71717a] cursor-not-allowed bg-transparent"
                                        : "border-[#27272a] text-white hover:border-[#d44d00] hover:text-[#d44d00] bg-[#09090b]"
                                    }`}
                                  >
                                    Anterior
                                  </button>
                                  
                                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                      key={page}
                                      onClick={() => {
                                        setCurrentPage(page);
                                        document.getElementById("populares-makerworld")?.scrollIntoView({ behavior: "smooth" });
                                      }}
                                      className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer border ${
                                        currentPage === page
                                          ? "border-[#d44d00] bg-[#d44d00] text-white"
                                          : "border-[#18181b] text-[#a1a1aa] hover:border-[#27272a] hover:text-white bg-[#09090b]"
                                      }`}
                                    >
                                      {page}
                                    </button>
                                  ))}
                                  
                                  <button
                                    onClick={() => {
                                      setCurrentPage(prev => Math.min(prev + 1, totalPages));
                                      document.getElementById("populares-makerworld")?.scrollIntoView({ behavior: "smooth" });
                                    }}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition cursor-pointer border ${
                                      currentPage === totalPages
                                        ? "border-[#18181b] text-[#71717a] cursor-not-allowed bg-transparent"
                                        : "border-[#27272a] text-white hover:border-[#d44d00] hover:text-[#d44d00] bg-[#09090b]"
                                    }`}
                                  >
                                    Próximo
                                  </button>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </>
                  )}
                </div>
                )}
              </div>
            )}

            {/* MODO MAKER: caminho feliz Supply-first */}
            {homeMode === "maker" && (
              <div className="space-y-16">
                {/* Hero do Maker */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-4">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d44d00]/10 border border-[#d44d00]/20 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d44d00] animate-pulse"></span>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#d44d00] mono-text">Fila de jobs para fabs homologadas</span>
                    </div>
                    <h1 className={`text-4xl md:text-6xl font-extrabold tracking-tighter leading-none ${
                      theme === "dark" ? "text-white" : "text-black"
                    }`}>
                      <span className="text-[#d44d00]">FabMakers</span>
                      <br />
                      Sua impressora ociosa vira trabalho pago.
                    </h1>
                    <p className={`text-sm md:text-base leading-relaxed max-w-xl ${
                      theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"
                    }`}>
                      Cadastre a fab, passe por KYC e calibração, veja a fila de demandas e aceite jobs com instruções claras — QA e pagamento na plataforma.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                      <button
                        onClick={() => {
                          if (currentUser && currentUser.role === "MAKER") {
                            goTo("maker");
                          } else {
                            setLoginRole("MAKER");
                            setLoginEmail("");
                            setLoginPassword("");
                            setLoginError("");
                            setShowLoginModal(true);
                          }
                        }}
                        className="px-6 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                      >
                        Credenciar fab / entrar
                      </button>
                      <button
                        onClick={() => {
                          document.getElementById("maker-como-funciona")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`px-6 py-3 border font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer ${
                          theme === "dark" 
                            ? "border-white/10 text-white hover:bg-white/5 bg-transparent" 
                            : "border-black/10 text-black hover:bg-black/5 bg-transparent"
                        }`}
                      >
                        Ver caminho feliz
                      </button>
                    </div>
                  </div>

                  <div id="maker-como-funciona" className={`lg:col-span-5 rounded-lg p-6 space-y-4 border ${
                    theme === "dark" ? "bg-[#09090b] border-[#18181b]" : "bg-white border-[#e4e4e7] shadow-sm"
                  }`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider mono-text border-b pb-2 ${
                      theme === "dark" ? "text-white border-[#18181b]" : "text-black border-[#e4e4e7]"
                    }`}>Caminho feliz (5 passos)</h3>
                    <ol className={`space-y-3 text-xs list-decimal pl-4 leading-relaxed ${
                      theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"
                    }`}>
                      <li><strong className={theme === "dark" ? "text-white" : "text-black"}>Cadastro:</strong> conta maker + máquinas e materiais.</li>
                      <li><strong className={theme === "dark" ? "text-white" : "text-black"}>KYC + calibração:</strong> cubo de teste e documentos.</li>
                      <li><strong className={theme === "dark" ? "text-white" : "text-black"}>Homologação:</strong> admin libera sandbox / rede.</li>
                      <li><strong className={theme === "dark" ? "text-white" : "text-black"}>Fila:</strong> aceite o job com prazo e instruções.</li>
                      <li><strong className={theme === "dark" ? "text-white" : "text-black"}>Entrega + pagamento:</strong> status até liberação.</li>
                    </ol>
                  </div>
                </div>

                {SHOW_LATER_UI && (
                /* Loja de Insumos & Afiliados — Park/Cut (Shopee) */
                <div id="insumos-shopee" className={`space-y-6 pt-6 border-t ${
                  theme === "dark" ? "border-[#18181b]/50" : "border-[#e4e4e7]"
                }`}>
                  <div>
                    <h2 className={`text-lg font-bold uppercase tracking-tight mono-text ${
                      theme === "dark" ? "text-white" : "text-black"
                    }`}>Loja de Insumos & Dropshipping de Parceiros</h2>
                    <p className={`text-xs mt-1 ${
                      theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"
                    }`}>
                      Compre insumos com desconto de fornecedores homologados (Shopee/TikTok Shop) ou gere links de afiliados para revender.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {lojaInsumos.map((prod) => (
                      <div key={prod.id} className={`rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-[#d44d00]/30 transition group border ${
                        theme === "dark" ? "bg-[#09090b] border-[#18181b]" : "bg-white border-[#e4e4e7] shadow-sm"
                      }`}>
                        <div className="space-y-3">
                          <div className={`aspect-square w-full rounded overflow-hidden ${
                            theme === "dark" ? "bg-[#18181b]" : "bg-[#f4f4f5]"
                          }`}>
                            <img src={prod.image} alt={prod.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          </div>
                          <div>
                            <span className={`text-[8px] border px-2 py-0.5 rounded font-bold uppercase tracking-wider mono-text inline-block ${
                              prod.platform === "SHOPEE" ? "bg-orange-500/10 border-orange-500/30 text-orange-500" :
                              prod.platform === "TIKTOK" ? "bg-pink-500/10 border-pink-500/30 text-pink-500" :
                              prod.platform === "AMAZON" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600" :
                              "bg-red-500/10 border-red-500/30 text-red-500"
                            }`}>
                              {prod.platform === "SHOPEE" ? "Shopee Dropshipping" :
                               prod.platform === "TIKTOK" ? "TikTok Shop Affiliate" :
                               prod.platform === "AMAZON" ? "Amazon Associate" :
                               "AliExpress Partner"}
                            </span>
                            <h4 className={`font-bold text-xs leading-snug mt-1.5 ${
                              theme === "dark" ? "text-white" : "text-black"
                            }`}>{prod.title}</h4>
                            <p className={`text-xs mt-0.5 ${
                              theme === "dark" ? "text-[#71717a]" : "text-[#71717a]"
                            }`}>Prazo: {prod.deliveryTime}</p>
                          </div>
                        </div>

                        <div className={`space-y-3 pt-2 border-t ${
                          theme === "dark" ? "border-[#18181b]/50" : "border-[#e4e4e7]"
                        }`}>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className={`text-sm font-extrabold mono-text block ${
                                theme === "dark" ? "text-white" : "text-black"
                              }`}>R$ {prod.price.toFixed(2)}</span>
                              <span className="text-[10px] text-[#71717a] block mt-0.5">
                                ou em até 6x de R$ {(prod.price / 6).toFixed(2).replace(".", ",")}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-[#10b981] font-bold block">Comissão: {prod.affiliateCommissionPercent}%</span>
                              <span className="text-[9px] text-[#71717a] block mt-0.5">Disponível na Shopee</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <a
                              href={prod.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`py-1.5 text-center text-xs font-bold uppercase rounded transition border ${
                                theme === "dark" 
                                  ? "bg-[#18181b] hover:bg-[#27272a] border-[#27272a] text-white" 
                                  : "bg-[#f4f4f5] hover:bg-[#e4e4e7] border-[#d4d4d8] text-black"
                              }`}
                            >
                              Comprar
                            </a>
                            <button
                              onClick={() => {
                                if (currentUser && currentUser.role === "MAKER") {
                                  const customLink = `${prod.link}?affiliateId=maker_${currentUser.name.replace(/\s+/g, "_").toLowerCase()}`;
                                  navigator.clipboard.writeText(customLink);
                                  alert(`Link de Afiliado copiado! Envie este link e ganhe ${prod.affiliateCommissionPercent}% de comissão quando alguém comprar: \n${customLink}`);
                                } else {
                                  alert("Apenas makers cadastrados e logados podem gerar links de afiliados para revenda. Faça o login de Maker!");
                                }
                              }}
                              className="py-1.5 bg-[#d44d00] hover:bg-[#b04000] text-xs font-bold text-white uppercase rounded transition cursor-pointer"
                            >
                              Revender
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </div>
            )}

            {/* MODO DESIGNER — Later (SHOW_LATER_UI) */}
            {SHOW_LATER_UI && homeMode === "designer" && (
              <div className="space-y-16">
                {/* Hero do Designer */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-4">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d44d00]/10 border border-[#d44d00]/20 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d44d00] animate-pulse"></span>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#d44d00] mono-text">Freelance & Venda de Arquivos Autorais</span>
                    </div>
                    <h1 className={`text-4xl md:text-6xl font-extrabold tracking-tighter leading-none ${
                      theme === "dark" ? "text-white" : "text-black"
                    }`}>
                      Crie modelos 3D? <br />
                      <span className="text-[#d44d00]">Precifique sua hora e venda suas criações.</span>
                    </h1>
                    <p className={`text-sm md:text-base leading-relaxed max-w-xl ${
                      theme === "dark" ? "text-[#a1a1aa]" : "text-[#4b5563]"
                    }`}>
                      Ganhe visibilidade na nossa rede de manufatura distribuída. Os clientes podem contratar seu serviço de modelagem técnica ou artística sob demanda por hora de trabalho ou comprar arquivos STL licenciados por você para impressão imediata.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                      {currentUser && currentUser.role === "DESIGNER" ? (
                        <button
                          onClick={() => {
                            setActiveTab("designer");
                          }}
                          className="px-6 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                        >
                          Ir para o Meu Painel de Designer
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setLoginRole("DESIGNER");
                            setLoginEmail("");
                            setLoginPassword("");
                            setLoginError("");
                            setShowLoginModal(true);
                          }}
                          className="px-6 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer animate-pulse"
                        >
                          Fazer Login / Cadastrar como Designer
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className={`rounded-lg p-6 space-y-4 relative overflow-hidden border ${
                      theme === "dark" ? "bg-[#09090b] border-[#18181b]" : "bg-[#f4f4f5] border-[#e4e4e7]"
                    }`}>
                      <h3 className={`text-xs font-bold uppercase tracking-wider mono-text border-b pb-2 ${
                        theme === "dark" ? "text-white" : "text-black"
                      }`}>Benefícios de ser Designer na plataforma</h3>
                      <div className="space-y-4 text-xs">
                        <div className="flex gap-3">
                          <span className={`w-5 h-5 rounded font-bold flex items-center justify-center flex-shrink-0 border text-[10px] ${
                            theme === "dark" ? "bg-[#18181b] border-[#27272a] text-[#d44d00]" : "bg-white border-[#d4d4d8] text-[#d44d00]"
                          }`}>1</span>
                          <div>
                            <h4 className={`font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>Liberdade de Preço</h4>
                            <p className={theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}>Defina seu valor-hora e suas horas semanais livres para novos jobs freelancer.</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <span className={`w-5 h-5 rounded font-bold flex items-center justify-center flex-shrink-0 border text-[10px] ${
                            theme === "dark" ? "bg-[#18181b] border-[#27272a] text-[#d44d00]" : "bg-white border-[#d4d4d8] text-[#d44d00]"
                          }`}>2</span>
                          <div>
                            <h4 className={`font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>Royalties nos STLs</h4>
                            <p className={theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}>Venda arquivos digitais na nossa galeria e ganhe royalties cada vez que um cliente pedir a impressão deles.</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <span className={`w-5 h-5 rounded font-bold flex items-center justify-center flex-shrink-0 border text-[10px] ${
                            theme === "dark" ? "bg-[#18181b] border-[#27272a] text-[#d44d00]" : "bg-white border-[#d4d4d8] text-[#d44d00]"
                          }`}>3</span>
                          <div>
                            <h4 className={`font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>Moderação e Selo de Confiança</h4>
                            <p className={theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}>Seja um designer aprovado por moderadores e ganhe prioridade de exibição para potenciais contratantes.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lista Pública de Modelistas 3D na Rede */}
                <div className="space-y-6 pt-8 border-t border-[#18181b]/20">
                  <div>
                    <h2 className={`text-xl font-bold tracking-tight uppercase mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>Designers 3D Disponíveis na Rede</h2>
                    <p className={`text-xs mt-1 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>Conheça e contrate profissionais especializados para o desenvolvimento de suas peças sob medida.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plataformaDesigners.filter(d => d.status === "APPROVED").map(d => (
                      <div key={d.id} className={`border rounded-lg p-5 flex flex-col justify-between space-y-4 ${
                        theme === "dark" ? "border-[#18181b] bg-[#09090b]/40" : "border-[#e4e4e7] bg-white shadow-sm"
                      }`}>
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className={`font-bold text-xs ${theme === "dark" ? "text-white" : "text-black"}`}>{d.name}</h4>
                              <span className="text-[9px] text-[#71717a] truncate block">{d.email}</span>
                            </div>
                            <span className="text-[8px] bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider mono-text">Aprovado</span>
                          </div>

                          <p className={`text-xs ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>{d.portfolio}</p>

                          <div className="flex flex-wrap gap-1">
                            {d.specialties.map((s, idx) => (
                              <span key={idx} className={`text-[8px] font-bold px-1.5 py-0.5 rounded mono-text ${
                                theme === "dark" ? "bg-[#18181b] text-white" : "bg-[#f4f4f5] text-black border border-[#e4e4e7]"
                              }`}>{s}</span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3 pt-3 border-t border-[#18181b]/50">
                          <div className="flex justify-between items-center text-xs">
                            <span className={theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}>Disponibilidade:</span>
                            <span className={`font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>{d.availability}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className={theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}>Preço por Hora:</span>
                            <span className="text-[#d44d00] font-black text-sm mono-text">R$ {d.hourRate.toFixed(2)}/h</span>
                          </div>
                          <button
                            onClick={() => alert(`Entre em contato com o designer via e-mail: ${d.email} para fechar seu orçamento de modelagem 3D.`)}
                            className="w-full py-2 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-center text-xs font-bold text-white uppercase rounded transition cursor-pointer"
                          >
                            Contratar Designer
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seção das Obras Autorais em Destaque */}
                <div className="space-y-6 pt-8 border-t border-[#18181b]/20">
                  <div>
                    <h2 className={`text-xl font-bold tracking-tight uppercase mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>Modelos Autorais para Venda e Impressão</h2>
                    <p className={`text-xs mt-1 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>Arquivos 3D exclusivos criados por designers licenciados na rede. Você compra o arquivo e o envia direto ao fatiador.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {designerObras.map(obra => (
                      <div key={obra.id} className={`border rounded-lg overflow-hidden flex flex-col justify-between ${
                        theme === "dark" ? "border-[#18181b] bg-[#09090b]/40" : "border-[#e4e4e7] bg-white shadow-sm"
                      }`}>
                        <div className="aspect-video w-full relative bg-[#18181b]">
                          <img src={obra.image || "https://images.unsplash.com/photo-1608889175123-8ec330b86f84?w=300"} alt={obra.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-4 space-y-3 flex-grow flex flex-col justify-between">
                          <div className="space-y-1">
                            <span className="text-[8px] bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mono-text inline-block">{obra.category}</span>
                            <h4 className={`font-bold text-xs leading-snug truncate ${theme === "dark" ? "text-white" : "text-black"}`}>{obra.title}</h4>
                            <p className={`text-[10px] leading-relaxed line-clamp-2 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>{obra.description}</p>
                          </div>
                          <div className="pt-2 border-t border-[#18181b]/50 flex justify-between items-center">
                            <span className="text-xs font-bold text-[#d44d00] mono-text">R$ {obra.price.toFixed(2)}</span>
                            <button
                              onClick={() => {
                                // Mock de licenciamento e envio automático para fatiador
                                setFile(new File([new ArrayBuffer(100)], obra.title.toLowerCase().replace(/\s+/g, "_") + ".stl", { type: "application/sla" }));
                                setMaterial("PLA");
                                setQuote({
                                  success: true,
                                  filename: obra.title.toLowerCase().replace(/\s+/g, "_") + ".stl",
                                  trianglesCount: 18450,
                                  boundingBox: { width: 100, depth: 100, height: 100 },
                                  metrics: { rawVolumeMm3: 15000, realVolumeCm3: 15.0, weightG: 18.0, timeHours: 1.2, timeFormatted: "1h 12m" },
                                  pricing: { materialCost: 2.16, machineCost: 14.40, makerProfit: 6.62, makerPayout: 32.0, platformFee: 8.0, royaltyPrice: obra.price, totalPrice: 40.0 + obra.price }
                                });
                                goTo("client");
                                setClientSubTab("upload");
                                alert(`Arquivo "${obra.title}" licenciado com sucesso por R$ ${obra.price.toFixed(2)} (royalties inclusos na cotação técnica do fatiador).`);
                              }}
                              className="px-2.5 py-1.5 bg-[#d44d00] hover:bg-[#b04000] text-white text-[9px] font-bold rounded uppercase tracking-wider transition cursor-pointer"
                            >
                              Licenciar & Imprimir
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
        {activeTab === "client" && (
          <div className="max-w-7xl mx-auto px-4 py-8">
            
            {/* GRID DO MARKETPLACE ESTILO MAKERWORLD */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* COLUNA ESQUERDA: MENU LATERAL (SIDEBAR) */}
              <div className="lg:col-span-3 space-y-6">
                {/* Perfil Rápido do Cliente (se logado) */}
                {currentUser && (
                  <div className={`p-4 border rounded-lg flex items-center gap-3 ${theme === "dark" ? "border-[#18181b] bg-[#09090b]/40" : "border-[#e4e4e7] bg-[#fafafa]"}`}>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#d44d00] to-orange-500 flex items-center justify-center text-white font-black text-xs shadow-md">
                      {currentUser.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <h4 className={`text-xs font-bold truncate ${theme === "dark" ? "text-white" : "text-black"}`}>{currentUser.name}</h4>
                      <p className="text-[10px] text-[#71717a]">Painel do Cliente</p>
                    </div>
                  </div>
                )}

                {/* Navegação Principal */}
                <div className="space-y-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-3 block mb-2 ${theme === "dark" ? "text-[#71717a]" : "text-[#71717a]"}`}>Navegação</span>
                  
                  <button
                    onClick={() => setClientSubTab("upload")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer text-left ${
                      clientSubTab === "upload"
                        ? "bg-[#d44d00]/10 text-[#d44d00] border-l-2 border-[#d44d00]"
                        : theme === "dark"
                          ? "text-[#a1a1aa] hover:text-white hover:bg-[#18181b]"
                          : "text-[#52525b] hover:text-black hover:bg-[#f4f4f5]"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Fatiador & Cotação (seed)</span>
                  </button>

                  {SHOW_LATER_UI && (
                  <button
                    onClick={() => setClientSubTab("gallery")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer text-left ${
                      clientSubTab === "gallery"
                        ? "bg-[#d44d00]/10 text-[#d44d00] border-l-2 border-[#d44d00]"
                        : theme === "dark"
                          ? "text-[#a1a1aa] hover:text-white hover:bg-[#18181b]"
                          : "text-[#52525b] hover:text-black hover:bg-[#f4f4f5]"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Todos os Modelos</span>
                  </button>
                  )}

                  {SHOW_LATER_UI && (
                  <button
                    onClick={() => setClientSubTab("ai")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer text-left ${
                      clientSubTab === "ai"
                        ? "bg-[#d44d00]/10 text-[#d44d00] border-l-2 border-[#d44d00]"
                        : theme === "dark"
                          ? "text-[#a1a1aa] hover:text-white hover:bg-[#18181b]"
                          : "text-[#52525b] hover:text-black hover:bg-[#f4f4f5]"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span>Assistente de IA 3D</span>
                  </button>
                  )}

                </div>

                {SHOW_LATER_UI && (
                <>
                <div className={`h-[1px] ${theme === "dark" ? "bg-[#18181b]" : "bg-[#e4e4e7]"}`}></div>

                {/* Categorias */}
                <div className="space-y-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-3 block mb-2 ${theme === "dark" ? "text-[#71717a]" : "text-[#71717a]"}`}>Categorias</span>
                  {[
                    { 
                      name: "Todos", 
                      keyword: "featured", 
                      icon: (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      )
                    },
                    { 
                      name: "Peças Técnicas", 
                      keyword: "holder", 
                      icon: (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )
                    },
                    { 
                      name: "Decoração", 
                      keyword: "vase", 
                      icon: (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )
                    },
                    { 
                      name: "Organização", 
                      keyword: "box", 
                      icon: (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      )
                    },
                    { 
                      name: "Brinquedos / Geek", 
                      keyword: "toy", 
                      icon: (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                      )
                    },
                    { 
                      name: "Miniaturas", 
                      keyword: "action", 
                      icon: (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.253.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.772-.557-.372-1.81.588-1.81h4.907a1 1 0 00.95-.69l1.519-4.674z" />
                        </svg>
                      )
                    },
                    { 
                      name: "Acessórios 3D", 
                      keyword: "printer", 
                      icon: (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        </svg>
                      )
                    }
                  ].map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => {
                        setClientSubTab("gallery");
                        handleCategorySearch(cat.keyword);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer text-left ${
                        theme === "dark"
                          ? "text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/60"
                          : "text-[#52525b] hover:text-black hover:bg-[#f4f4f5]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-[#a1a1aa]">{cat.icon}</span>
                        <span>{cat.name}</span>
                      </div>
                      <span className="text-[10px] text-[#71717a] font-mono">→</span>
                    </button>
                  ))}
                </div>
                </>
                )}
              </div>

              {/* COLUNA DIREITA: CONTEÚDO PRINCIPAL (lg:col-span-9) */}
              <div className="lg:col-span-9 space-y-8">
                
                {/* 1. Sub-Aba: UPLOAD STL (Fatiador atual) */}
                {clientSubTab === "upload" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className={`text-xl font-bold tracking-tight uppercase mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>Seed de demanda — Cotação STL</h2>
                      <p className={`text-xs mt-1 leading-relaxed ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#4b5563]"}`}>
                        Upload do STL alimenta a fila de jobs das fabs. Orçamento automático e roteamento para maker homologado.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Coluna da Esquerda: Fatiador & Configurações */}
                      <div className={`${quote ? "lg:col-span-7" : "lg:col-span-12"} space-y-6`}>

                    {/* Upload */}
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded p-10 text-center transition ${
                        isDragActive 
                          ? "border-[#d44d00] bg-[#d44d00]/5" 
                          : file 
                            ? "border-[#10b981]/30 bg-[#10b981]/2" 
                            : theme === "dark"
                              ? "border-[#18181b] hover:border-[#27272a] bg-[#09090b]"
                              : "border-[#d4d4d8] hover:border-[#a1a1aa] bg-[#f4f4f5]"
                      }`}
                    >
                      <input ref={fileInputRef} type="file" accept=".stl" onChange={handleFileChange} className="hidden" />

                      {!file ? (
                        <div className="space-y-4">
                          <div className={`w-10 h-10 rounded flex items-center justify-center mx-auto border ${
                            theme === "dark" ? "bg-[#18181b] border-[#27272a]" : "bg-[#e4e4e7] border-[#d4d4d8]"
                          }`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <div>
                            <button onClick={handleBrowseFiles} className="text-[#d44d00] hover:text-[#b04000] font-semibold text-xs cursor-pointer">
                              Selecione seu arquivo STL
                            </button>
                            <p className={`text-xs mt-1 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>Arraste o arquivo geométrico</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleSimulateExample}
                            className={`text-xs mono-text px-3 py-1.5 rounded transition cursor-pointer border inline-flex items-center gap-1.5 ${
                            theme === "dark" 
                              ? "text-[#a1a1aa] hover:text-white bg-[#18181b] border-[#27272a]" 
                              : "text-[#52525b] hover:text-black bg-[#e4e4e7] border-[#d4d4d8]"
                          }`}>
                            <Icon name="precision_manufacturing" className="text-[16px]" />
                            Usar engrenagem de exemplo
                          </button>
                        </div>
                      ) : (
                        <div className={`flex justify-between items-center border p-4 rounded ${
                          theme === "dark" ? "bg-[#18181b]/50 border-[#27272a]" : "bg-[#fafafa] border-[#e4e4e7]"
                        }`}>
                          <div className="flex items-center gap-3 text-left">
                            {selectedModelImage ? (
                              <div className={`w-12 h-12 rounded overflow-hidden border flex-shrink-0 ${
                                theme === "dark" ? "border-[#27272a] bg-[#18181b]" : "border-[#e4e4e7] bg-white"
                              }`}>
                                <img src={selectedModelImage} alt="Preview do modelo" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded bg-[#10b981]/15 text-[#10b981] flex items-center justify-center border border-[#10b981]/20">
                                <Icon name="check_circle" className="text-[18px]" />
                              </div>
                            )}
                            <div>
                              <h4 className={`font-semibold text-xs truncate max-w-[200px] mono-text ${
                                theme === "dark" ? "text-white" : "text-black"
                              }`}>{file.name}</h4>
                              <p className={`text-xs ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>
                                {curatedCatalogId ? "Modelo do catálogo FabMakers" : "Arquivo de engenharia carregado"}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleClear}
                            className={`p-1.5 rounded transition ${
                              theme === "dark" ? "text-[#71717a] hover:text-red-400 hover:bg-[#18181b]" : "text-[#71717a] hover:text-red-600 hover:bg-[#f4f4f5]"
                            }`}
                          >
                            <Icon name="close" className="text-[18px]" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Parâmetros */}
                    <div className={`technical-panel rounded p-6 space-y-6 border ${
                      theme === "dark" ? "border-[#18181b]" : "border-[#e4e4e7] bg-white"
                    }`}>
                      <h3 className={`text-xs font-semibold uppercase tracking-wider mono-text border-b pb-3 ${
                        theme === "dark" ? "text-white border-[#18181b]" : "text-black border-[#e4e4e7]"
                      }`}>Configurações Físicas</h3>
                      
                      <div className="space-y-3">
                        <label className={`text-xs font-semibold uppercase tracking-wider mono-text ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#4b5563]"}`}>Material do Filamento</label>
                        <div className="grid grid-cols-4 gap-2">
                          {["PLA", "ABS", "PETG", "Resina"].map((mat) => (
                            <button
                              key={mat}
                              onClick={() => handleMaterialChange(mat)}
                              className={`p-2 border text-xs font-semibold transition rounded cursor-pointer ${
                                material === mat 
                                  ? theme === "dark" 
                                    ? "border-[#d44d00] bg-[#d44d00]/10 text-white font-bold" 
                                    : "border-[#d44d00] bg-[#d44d00]/10 text-black font-bold"
                                  : theme === "dark"
                                    ? "border-[#18181b] bg-transparent text-[#71717a] hover:border-[#27272a] hover:text-white"
                                    : "border-[#e4e4e7] bg-transparent text-[#52525b] hover:border-[#a1a1aa] hover:text-black"
                              }`}
                            >
                              {mat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Explicação e detalhes do material selecionado */}
                      {(() => {
                        const details = materialDetails[material as keyof typeof materialDetails];
                        if (!details) return null;
                        return (
                          <div className={`border p-4 rounded space-y-3 ${
                            theme === "dark" ? "bg-[#09090b] border-[#18181b]" : "bg-[#fafafa] border-[#e4e4e7]"
                          }`}>
                            <div className={`flex justify-between items-center border-b pb-2 ${
                              theme === "dark" ? "border-[#18181b]/60" : "border-[#e4e4e7]"
                            }`}>
                              <span className={`text-xs font-bold mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>{details.name}</span>
                              <span className="text-[9px] text-[#71717a] uppercase font-bold tracking-wider">Ficha Técnica</span>
                            </div>
                            <p className={`text-xs leading-relaxed ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
                              <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>O que é:</span> {details.description}
                            </p>
                            <p className={`text-xs leading-relaxed ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
                              <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>Resistência:</span> {details.resistance}
                            </p>
                            <p className={`text-xs leading-relaxed ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
                              <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>Aplicações:</span> {details.application}
                            </p>
                          </div>
                        );
                      })()}

                      {/* Paleta de Cores do Material */}
                      {(() => {
                        const details = materialDetails[material as keyof typeof materialDetails];
                        if (!details) return null;
                        return (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider mono-text">Cor do Filamento</label>
                              <span className="text-xs font-bold text-[#d44d00] mono-text">{isMultipart ? "Multicores (Multipartes)" : selectedColor}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {details.colors.map((c) => (
                                <button
                                  key={c.name}
                                  type="button"
                                  onClick={() => {
                                    setSelectedColor(c.name);
                                    setIsMultipart(false); // Desativa multipartes se o usuário escolher uma cor sólida manual
                                  }}
                                  className={`w-8 h-8 rounded-full border-2 transition cursor-pointer relative flex items-center justify-center`}
                                  style={{
                                    backgroundColor: c.hex,
                                    borderColor: selectedColor === c.name && !isMultipart ? "#d44d00" : "#18181b"
                                  }}
                                  title={c.name}
                                >
                                  {selectedColor === c.name && !isMultipart && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#d44d00]"></span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Multipartes & Inteligência Artificial */}
                      {selectedModelImage && (
                        <div className="border border-[#18181b] p-4 rounded bg-[#09090b]/40 space-y-3">
                          <div className="flex justify-between items-center gap-4">
                            <div>
                              <h4 className="text-xs font-bold text-white uppercase mono-text">🌈 Peça Multicolorida / Multipartes</h4>
                              <p className="text-[10px] text-[#71717a] mt-0.5">Extraia a combinação de cores do modelo real da imagem via IA.</p>
                            </div>
                            <button
                              type="button"
                              onClick={handleExtractColorsFromImage}
                              disabled={extractingColors}
                              className="px-3 py-1.5 bg-[#18181b] border border-[#27272a] hover:border-[#d44d00] text-[10px] font-bold uppercase tracking-wider text-white rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 flex-shrink-0"
                            >
                              {extractingColors ? (
                                <>
                                  <div className="w-3 h-3 rounded-full border border-dashed border-[#71717a] border-t-[#d44d00] animate-spin"></div>
                                  <span>Analisando...</span>
                                </>
                              ) : (
                                <>
                                  <span>🤖 Extrair Cores (IA)</span>
                                </>
                              )}
                            </button>
                          </div>

                          {isMultipart && multipartColors.length > 0 && (
                            <div className="p-3 bg-[#10b981]/5 border border-[#10b981]/15 rounded space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-[#10b981] font-bold uppercase tracking-wider bg-[#10b981]/10 px-2 py-0.5 rounded">Multipartes Habilitado</span>
                              </div>
                              <p className="text-[10px] text-[#a1a1aa] leading-relaxed">
                                A peça será manufaturada em múltiplos componentes respeitando as cores extraídas do modelo original:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {multipartColors.map((colorName) => {
                                  let colorHex = "#d44d00";
                                  const allColors = Object.values(materialDetails).flatMap(m => m.colors);
                                  const found = allColors.find(col => col.name === colorName);
                                  if (found) colorHex = found.hex;

                                  return (
                                    <div key={colorName} className="flex items-center gap-1.5 bg-[#18181b] border border-[#27272a] px-2.5 py-1 rounded text-[10px] text-white">
                                      <span className="w-2 h-2 rounded-full border border-[#27272a]" style={{ backgroundColor: colorHex }}></span>
                                      <span>{colorName}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs text-[#a1a1aa] uppercase tracking-wider mono-text">
                          <label>Densidade Interna (Infill)</label>
                          <span className="text-[#d44d00]">{infill}%</span>
                        </div>
                        <input
                          type="range" min="10" max="100" step="5" value={infill}
                          onChange={(e) => handleInfillChange(parseInt(e.target.value))}
                          className="w-full accent-[#d44d00] h-1 bg-[#18181b] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Altura da Camada (Resolução) */}
                      <div className="space-y-3">
                        <label className={`text-xs font-semibold uppercase tracking-wider mono-text ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#4b5563]"}`}>Altura da Camada (Resolução)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: "0.12", label: "0.12mm (Fina)" },
                            { value: "0.20", label: "0.20mm (Normal)" },
                            { value: "0.28", label: "0.28mm (Draft)" }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleLayerHeightChange(opt.value)}
                              className={`p-2 border text-[10px] font-bold transition rounded cursor-pointer ${
                                layerHeight === opt.value
                                  ? theme === "dark"
                                    ? "border-[#d44d00] bg-[#d44d00]/10 text-white font-bold"
                                    : "border-[#d44d00] bg-[#d44d00]/10 text-black font-bold"
                                  : theme === "dark"
                                    ? "border-[#18181b] bg-transparent text-[#71717a] hover:border-[#27272a] hover:text-white"
                                    : "border-[#e4e4e7] bg-transparent text-[#52525b] hover:border-[#a1a1aa] hover:text-black"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Padrão de Preenchimento (Infill Pattern) */}
                      <div className="space-y-3">
                        <label className={`text-xs font-semibold uppercase tracking-wider mono-text ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#4b5563]"}`}>Padrão de Preenchimento (IA/Resistência)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: "grid", label: "Grid (Grade)" },
                            { value: "gyroid", label: "Giroide" },
                            { value: "honeycomb", label: "Colmeia" }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleInfillPatternChange(opt.value)}
                              className={`p-2 border text-[10px] font-bold transition rounded cursor-pointer ${
                                infillPattern === opt.value
                                  ? theme === "dark"
                                    ? "border-[#d44d00] bg-[#d44d00]/10 text-white font-bold"
                                    : "border-[#d44d00] bg-[#d44d00]/10 text-black font-bold"
                                  : theme === "dark"
                                    ? "border-[#18181b] bg-transparent text-[#71717a] hover:border-[#27272a] hover:text-white"
                                    : "border-[#e4e4e7] bg-transparent text-[#52525b] hover:border-[#a1a1aa] hover:text-black"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                      {/* Coluna da Direita: Cotação & Logística */}
                      <div className="lg:col-span-5 space-y-6">
                        
                        {quote ? (
                          <div className={`technical-panel rounded-lg p-6 space-y-5 border ${
                            theme === "dark" ? "border-[#18181b] bg-[#09090b]/40" : "border-[#e4e4e7] bg-white shadow-sm"
                          }`}>
                            <div className={`text-center pb-4 border-b ${theme === "dark" ? "border-[#18181b]" : "border-[#e4e4e7]"}`}>
                              <span className={`text-[10px] font-bold uppercase tracking-wider mono-text ${theme === "dark" ? "text-[#71717a]" : "text-[#71717a]"}`}>Valor Total Estimado</span>
                              <div className="text-3xl font-extrabold text-[#d44d00] mt-1 mono-text">
                                R$ {quote.pricing.totalPrice.toFixed(2).replace(".", ",")}
                              </div>
                            </div>
                            
                            <div className={`space-y-2 text-xs mono-text ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
                              <div className="flex justify-between"><span>Tempo de Impressão</span><span className={theme === "dark" ? "text-white font-bold" : "text-black font-bold"}>{quote.metrics.timeFormatted}</span></div>
                              <div className="flex justify-between"><span>Consumo de Material</span><span className={theme === "dark" ? "text-white font-bold" : "text-black font-bold"}>{quote.metrics.weightG}g</span></div>
                              <div className="flex justify-between"><span>Material Escolhido</span><span className={theme === "dark" ? "text-white font-bold" : "text-black font-bold"}>{material}</span></div>
                              <div className="flex justify-between"><span>Dimensões Limites</span><span className={theme === "dark" ? "text-white font-bold" : "text-black font-bold"}>{quote.boundingBox.width.toFixed(1)} x {quote.boundingBox.depth.toFixed(1)} x {quote.boundingBox.height.toFixed(1)} mm</span></div>
                            </div>

                            {/* Campo de CEP do Cliente (ViaCEP) */}
                            <div className={`space-y-2 border-t pt-4 ${theme === "dark" ? "border-[#18181b]" : "border-[#e4e4e7]"}`}>
                              <label className={`text-[10px] font-bold uppercase tracking-wider mono-text ${theme === "dark" ? "text-[#71717a]" : "text-[#71717a]"}`}>CEP de Entrega para Cotação Logística</label>
                              <input 
                                type="text" value={clientZip} 
                                onChange={(e) => handleClientZipChange(e.target.value)} 
                                placeholder="Ex: 13083-970" 
                                className={`w-full border rounded-lg p-2.5 text-xs focus:border-[#d44d00] focus:outline-none transition ${
                                  theme === "dark" ? "bg-[#050506] border-[#18181b] text-white" : "bg-white border-[#d4d4d8] text-black"
                                }`} 
                              />
                              {clientZipLoading && <p className="text-xs text-yellow-500 mono-text animate-pulse">Buscando localidade e calculando frete...</p>}
                              {clientAddress && (
                                <p className="text-xs text-[#10b981] font-semibold mono-text mt-0.5 flex items-center gap-1">
                                  <Icon name="location_on" size={14} /> {clientAddress}
                                </p>
                              )}
                            </div>

                            {/* Sonar / Radar de Proximidade */}
                            {clientZip && (
                              <div className={`border rounded-lg p-4 space-y-3 ${theme === "dark" ? "border-[#18181b] bg-[#050506]" : "border-[#e4e4e7] bg-[#f9f9fb]"}`}>
                                <div className={`flex justify-between items-center text-[9px] uppercase tracking-wider font-bold mono-text border-b pb-2 ${
                                  theme === "dark" ? "text-[#71717a] border-[#18181b]" : "text-[#71717a] border-[#e4e4e7]"
                                }`}>
                                  <span>Radar de Proximidade</span>
                                  <span className={isScanningRadar ? "text-yellow-500 animate-pulse" : "text-[#10b981]"}>
                                    {isScanningRadar ? "Escaneando Rede..." : "Rede Pronta"}
                                  </span>
                                </div>

                                {isScanningRadar ? (
                                  <div className="flex flex-col items-center justify-center py-6 space-y-3 relative overflow-hidden">
                                    <div className="w-12 h-12 rounded-full border border-[#d44d00]/30 flex items-center justify-center animate-ping absolute"></div>
                                    <div className="w-20 h-20 rounded-full border border-[#d44d00]/20 flex items-center justify-center animate-ping absolute"></div>
                                    <svg className="w-10 h-10 text-[#d44d00] animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span className="text-xs text-[#71717a] mono-text">Escaneando e avaliando compatibilidades...</span>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {nearbyMakers.length > 0 ? (
                                      <div className="space-y-2">
                                        <p className="text-[9px] text-[#71717a] uppercase tracking-wider font-bold mono-text">Makers compatíveis próximos:</p>
                                        {nearbyMakers.map((maker, idx) => {
                                          const presetMatch = PRINTER_PRESETS.find(p => `${p.brand} ${p.model}` === maker.machine);
                                          const fitsVolume = presetMatch 
                                            ? (presetMatch.volumeX >= quote.boundingBox.width && presetMatch.volumeY >= quote.boundingBox.depth && presetMatch.volumeZ >= quote.boundingBox.height)
                                            : true;
                                          const meetsEnclosure = (material === "ABS" || material === "ASA")
                                            ? (presetMatch ? presetMatch.hasEnclosure : true)
                                            : true;
                                          const isCompatible = fitsVolume && meetsEnclosure;

                                          return (
                                            <div key={idx} className={`p-2.5 border rounded text-xs space-y-1.5 ${
                                              isCompatible 
                                                ? theme === "dark" ? "border-[#18181b] bg-[#09090b]/80" : "border-[#e4e4e7] bg-white shadow-sm"
                                                : "border-red-500/10 bg-red-500/5 opacity-50"
                                            }`}>
                                              <div className="flex justify-between items-center font-bold">
                                                <span className={theme === "dark" ? "text-white" : "text-black"}>{maker.name}</span>
                                                <span className={isCompatible ? "text-[#10b981]" : "text-red-400"}>
                                                  {isCompatible ? `${maker.distanceKm.toFixed(1)} km` : "Incompatível"}
                                                </span>
                                              </div>
                                              <div className="flex justify-between items-center text-[10px] text-[#71717a]">
                                                <span>Máquina: {maker.machine}</span>
                                                <span className="inline-flex items-center gap-0.5">Nota: <Icon name="star" size={14} filled className="text-amber-500" />{maker.rating.toFixed(1)}</span>
                                              </div>
                                              {!isCompatible && (
                                                <p className="text-[8px] text-red-400 font-semibold mono-text mt-0.5">
                                                  <span className="inline-flex items-center gap-1">
                                                    <Icon name="warning" size={14} />
                                                    {!fitsVolume ? "Mesa útil menor que a peça" : "Exige impressora fechada"}
                                                  </span>
                                                </p>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-[#71717a] text-center py-2">Nenhum maker retornado.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <button
                              onClick={dispatchOrder}
                              disabled={clientZip.replace(/\D/g, "").length !== 8}
                              className={`w-full py-3 font-bold text-xs uppercase tracking-wider rounded-lg transition cursor-pointer ${
                                clientZip.replace(/\D/g, "").length === 8
                                  ? "bg-[#d44d00] hover:bg-[#b04000] text-white shadow-md shadow-[#d44d00]/10"
                                  : theme === "dark"
                                    ? "bg-[#18181b] border border-[#27272a] text-[#71717a] cursor-not-allowed"
                                    : "bg-[#e4e4e7] border border-[#d4d4d8] text-[#71717a] cursor-not-allowed"
                              }`}
                            >
                              Enviar para a fila das fabs
                            </button>
                            <p className={`text-[10px] text-center mono-text ${theme === "dark" ? "text-[#71717a]" : "text-[#71717a]"}`}>
                              O pedido entra em WAITING_MAKER — fabs homologadas aceitam na fila.
                            </p>
                          </div>
                        ) : (
                          <div className={`technical-panel rounded-lg p-10 text-center flex flex-col items-center justify-center min-h-[180px] border ${
                            theme === "dark" ? "border-[#18181b] bg-[#09090b]/40 text-[#71717a]" : "border-[#e4e4e7] bg-white text-[#52525b] shadow-sm"
                          }`}>
                            <p className="text-xs mono-text">Aguardando fatiamento para gerar cotação técnica.</p>
                          </div>
                        )}

                        {/* Rastreamento de Pedidos do Cliente (Dentro do Fatiador) */}
                        <div className={`technical-panel rounded-lg p-6 space-y-6 border ${
                          theme === "dark" ? "border-[#18181b] bg-[#09090b]/40" : "border-[#e4e4e7] bg-white shadow-sm"
                        }`}>
                          <h3 className={`text-xs font-semibold uppercase tracking-wider mono-text border-b pb-3 ${
                            theme === "dark" ? "text-white border-[#18181b]" : "text-black border-[#e4e4e7]"
                          }`}>Seus Pedidos & Rastreamento</h3>
                          
                          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                            {orders.length === 0 ? (
                              <p className={`text-xs text-center py-4 mono-text ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>Nenhum pedido efetuado.</p>
                            ) : (
                              orders.map((ord) => (
                                <div key={ord.id} className={`border p-4 rounded-lg space-y-3 ${
                                  theme === "dark" ? "border-[#18181b] bg-[#050506]" : "border-[#e4e4e7] bg-[#f4f4f5]/60"
                                }`}>
                                  <div className="flex justify-between items-center">
                                    <span className={`text-xs font-bold mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>PEDIDO #{ord.id}</span>
                                    <span className={`text-[8px] font-bold px-2 py-0.5 rounded mono-text uppercase border ${
                                      ord.status === "WAITING_MAKER" ? "border-yellow-500/30 text-yellow-500 bg-yellow-500/5" :
                                      ord.status === "PRINTING" ? "border-[#d44d00]/30 text-[#d44d00] bg-[#d44d00]/5 animate-pulse" :
                                      ord.status === "SHIPPED" ? "border-blue-500/30 text-blue-500 bg-blue-500/5" :
                                      ord.status === "COMPLETED" ? "border-green-500/30 text-green-500 bg-green-500/5" :
                                      "border-red-500/30 text-red-500 bg-red-500/5"
                                    }`}>
                                      {ord.status === "WAITING_MAKER" ? "Aguardando Maker" :
                                       ord.status === "PRINTING" ? `Imprimindo (${ord.progress}%)` :
                                       ord.status === "SHIPPED" ? "Despachado" :
                                       ord.status === "COMPLETED" ? "Concluído" : "Cancelado"}
                                    </span>
                                  </div>
                                  
                                  <div className={`text-xs space-y-1 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>
                                    <p className="truncate">Peça: <span className={theme === "dark" ? "text-white font-semibold" : "text-black font-semibold"}>{ord.filename}</span></p>
                                    <p>Fabricado por: <span className={theme === "dark" ? "text-white" : "text-black"}>{ord.makerName || "Procurando parceiro..."}</span></p>
                                    <p>Total: <span className="text-[#d44d00] font-bold">R$ {ord.totalPrice.toFixed(2).replace(".", ",")}</span></p>
                                  </div>

                                  {/* Rota lograda do pedido */}
                                  {(ord.status === "PRINTING" || ord.status === "SHIPPED" || ord.status === "WAITING_MAKER") && (
                                    <div className="pt-2">
                                      <div className={`h-16 rounded relative overflow-hidden flex items-center justify-center border ${
                                        theme === "dark" ? "bg-[#020203] border-[#18181b]" : "bg-[#fafafa] border-[#e4e4e7]"
                                      }`}>
                                        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--zinc-800)_1px,transparent_1px),linear-gradient(to_bottom,var(--zinc-800)_1px,transparent_1px)] bg-[size:8px_8px] opacity-20"></div>
                                        
                                        <svg className="absolute inset-0 w-full h-full">
                                          {ord.status !== "WAITING_MAKER" && (
                                            <line x1="30" y1="32" x2="160" y2="32" stroke="#d44d00" strokeWidth="1" strokeDasharray="3 3" />
                                          )}
                                        </svg>
                                        
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                          <span className={`w-2 h-2 rounded-full ${ord.status === "WAITING_MAKER" ? "bg-yellow-500 animate-ping" : "bg-[#d44d00]"} border border-black/10`}></span>
                                          <span className="text-[6px] mt-0.5 mono-text text-[#71717a]">Maker</span>
                                        </div>
                                        
                                        {ord.status !== "WAITING_MAKER" && (
                                          <div className={`absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 text-[7px] font-bold px-1.5 py-0.5 rounded mono-text z-10 border ${
                                            theme === "dark" ? "bg-[#09090b] border-[#18181b] text-white" : "bg-white border-[#e4e4e7] text-black"
                                          }`}>
                                            <span className="inline-flex items-center gap-1">
                                              {ord.status === "PRINTING" ? (
                                                <><Icon name="print" size={14} /> IMPRIMINDO</>
                                              ) : (
                                                <><Icon name="local_shipping" size={14} /> TRANSIT</>
                                              )}
                                            </span>
                                          </div>
                                        )}

                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                                          <span className="w-2 h-2 rounded-full bg-white border border-black/10"></span>
                                          <span className="text-[6px] mt-0.5 mono-text text-[#71717a]">Cliente</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Sub-Aba: GALERIA DE MODELOS PRONTOS */}
                {clientSubTab === "gallery" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className={`text-xl font-bold tracking-tight uppercase mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>Galeria da Rede FabMakers</h2>
                      <p className={`text-xs mt-1 leading-relaxed ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#4b5563]"}`}>
                        Escolha um dos modelos homologados e criados por designers da nossa rede para imprimir diretamente.
                      </p>
                    </div>

                    <form onSubmit={handleGallerySearch} className="flex gap-2">
                      <div className="relative flex-grow">
                        <input
                          type="text"
                          placeholder="Pesquise na galeria (ex: 'xbox', 'vaso', 'suporte')..."
                          value={gallerySearchQuery}
                          onChange={(e) => setGallerySearchQuery(e.target.value)}
                          className={`w-full border rounded pl-10 pr-3 py-2 text-xs focus:outline-none focus:border-[#d44d00] transition ${
                            theme === "dark" ? "bg-[#09090b] border-[#18181b] text-white" : "bg-white border-[#d4d4d8] text-black"
                          }`}
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-[#71717a]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={galleryLoading}
                        className="px-6 py-2 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer flex items-center gap-2"
                      >
                        {galleryLoading ? "Buscando..." : "Pesquisar"}
                      </button>
                    </form>

                    {galleryLoading ? (
                      <div className="py-12 text-center">
                        <div className="w-8 h-8 rounded-full border border-dashed border-[#71717a] border-t-[#d44d00] animate-spin mx-auto"></div>
                        <p className="text-xs text-[#71717a] mt-3">Carregando galeria de modelos...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {galleryModels.map((item) => (
                          <div key={item.id} className={`bg-transparent border rounded-lg overflow-hidden flex flex-col justify-between transition group hover:border-[#d44d00]/40 ${
                            theme === "dark" ? "border-[#18181b] hover:bg-[#18181b]/30" : "border-[#e4e4e7] hover:bg-[#f4f4f5]"
                          }`}>
                            <div className="aspect-video w-full relative overflow-hidden bg-[#18181b]">
                              <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            </div>
                            <div className="p-4 space-y-4 flex-grow flex flex-col justify-between">
                              <div>
                                <h4 className={`font-bold text-sm leading-tight line-clamp-2 ${theme === "dark" ? "text-white" : "text-black"}`}>{item.title}</h4>
                                <p className={`text-xs mt-1 ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>
                                  Material sugerido: <span className={`font-bold ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#18181b]"}`}>{item.material || "PLA"}</span> | Peso: {item.weightG}g
                                </p>
                              </div>
                              <div className={`flex justify-between items-center pt-2 border-t ${theme === "dark" ? "border-[#18181b]/50" : "border-[#e4e4e7]"}`}>
                                <span className={`text-sm font-extrabold mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>R$ {item.totalPrice.toFixed(2)}</span>
                                <button
                                  onClick={() => {
                                    // Injeta os dados da galeria no Quote
                                    setSelectedModelImage(item.image); // Leva a imagem do modelo para a cotação
                                    setFile(new File([new ArrayBuffer(100)], item.stlName, { type: "application/sla" }));
                                    setMaterial(item.material || "PLA");
                                    setQuote({
                                      success: true,
                                      filename: item.stlName,
                                      trianglesCount: 15420,
                                      boundingBox: { width: 120, depth: 80, height: 160 },
                                      metrics: {
                                        rawVolumeMm3: item.weightG * 1000,
                                        realVolumeCm3: item.weightG / 1.2,
                                        weightG: item.weightG,
                                        timeHours: item.weightG / 18,
                                        timeFormatted: item.timeFormatted
                                      },
                                      pricing: {
                                        materialCost: item.weightG * 0.12,
                                        machineCost: (item.weightG / 18) * 12,
                                        makerProfit: (item.weightG * 0.12 + (item.weightG / 18) * 12) * 0.40,
                                        makerPayout: item.totalPrice * 0.80,
                                        platformFee: item.totalPrice * 0.20,
                                        royaltyPrice: 0.0,
                                        totalPrice: item.totalPrice
                                      }
                                    });
                                    setClientZip("01001-000"); // CEP padrão para teste rápido
                                    alert(`Modelo "${item.title}" importado e cotado com sucesso! Agora configure o CEP para fechar o pedido.`);
                                    setClientSubTab("upload"); // Joga para a cotação fatiador
                                  }}
                                  className="px-3 py-1.5 bg-[#d44d00] hover:bg-[#b04000] text-white text-xs font-bold rounded uppercase tracking-wider transition cursor-pointer"
                                >
                                  Selecionar
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}



                {/* 4. Sub-Aba: ASSISTENTE DE IA 3D */}
                {clientSubTab === "ai" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-white uppercase mono-text">Idealizador de Projetos IA</h2>
                      <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                        Descreva em linguagem natural o que você quer fabricar. A IA indicará o material técnico adequado e proporá um orçamento correspondente.
                      </p>
                    </div>

                    {/* Janela de Chat */}
                    <div className="border border-[#18181b] bg-[#09090b] rounded-lg p-4 space-y-4 max-h-[350px] overflow-y-auto">
                      {aiChatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded p-3 text-xs space-y-3 ${
                            msg.role === "user" 
                              ? "bg-[#d44d00]/15 text-[#f4f4f5] border border-[#d44d00]/30" 
                              : "bg-[#18181b] text-[#a1a1aa] border border-[#27272a]"
                          }`}>
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            
                            {/* Proposta Paramétrica se houver */}
                            {msg.recommendedParams && (
                              <div className="bg-[#050506] border border-[#18181b] p-3 rounded space-y-2 mt-2">
                                <span className="text-xs uppercase tracking-wider font-bold text-[#d44d00] block mono-text">Parâmetros de Fabricação Sugeridos</span>
                                <div className="grid grid-cols-2 gap-2 text-xs text-[#71717a] border-b border-[#18181b] pb-2">
                                  <div>Arquivo: <span className="text-white font-bold">{msg.recommendedParams.filename}</span></div>
                                  <div>Material: <span className="text-white font-bold">{msg.recommendedParams.material}</span></div>
                                  <div>Preenchimento (Infill): <span className="text-white font-bold">{msg.recommendedParams.infill}%</span></div>
                                  <div>Peso Estimado: <span className="text-white font-bold">{msg.recommendedParams.weightG}g</span></div>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                  <span className="text-xs font-bold text-white mono-text">Orçamento: R$ {msg.recommendedParams.totalPrice.toFixed(2)}</span>
                                  <button
                                    onClick={() => {
                                      setFile(new File([new ArrayBuffer(100)], msg.recommendedParams!.filename, { type: "application/sla" }));
                                      setMaterial(msg.recommendedParams!.material);
                                      setInfill(msg.recommendedParams!.infill);
                                      setQuote({
                                        success: true,
                                        filename: msg.recommendedParams!.filename,
                                        trianglesCount: 18450,
                                        boundingBox: { width: 140, depth: 100, height: 80 },
                                        metrics: {
                                          rawVolumeMm3: msg.recommendedParams!.weightG * 1000,
                                          realVolumeCm3: msg.recommendedParams!.weightG / 1.2,
                                          weightG: msg.recommendedParams!.weightG,
                                          timeHours: msg.recommendedParams!.weightG / 18,
                                          timeFormatted: msg.recommendedParams!.timeFormatted
                                        },
                                        pricing: {
                                          materialCost: msg.recommendedParams!.weightG * 0.12,
                                          machineCost: (msg.recommendedParams!.weightG / 18) * 12,
                                          makerProfit: (msg.recommendedParams!.weightG * 0.12 + (msg.recommendedParams!.weightG / 18) * 12) * 0.40,
                                          makerPayout: msg.recommendedParams!.totalPrice * 0.80,
                                          platformFee: msg.recommendedParams!.totalPrice * 0.20,
                                          royaltyPrice: 0.0,
                                          totalPrice: msg.recommendedParams!.totalPrice
                                        }
                                      });
                                      setClientZip("01001-000");
                                      alert(`Orçamento da IA "${msg.recommendedParams!.filename}" aceito e carregado! Informe o CEP para rotear para o fabricante.`);
                                      setClientSubTab("upload"); // Joga para a cotação fatiador
                                    }}
                                    className="px-2.5 py-1 bg-[#d44d00] hover:bg-[#b04000] text-white text-xs font-bold rounded uppercase tracking-wider transition cursor-pointer"
                                  >
                                    Aceitar Proposta & Cotar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {aiLoading && (
                        <div className="flex justify-start">
                          <div className="bg-[#18181b] border border-[#27272a] rounded p-3 flex gap-2 items-center">
                            <span className="w-1.5 h-1.5 bg-[#d44d00] rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-[#d44d00] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 bg-[#d44d00] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chat Form */}
                    <form onSubmit={handleSendMessageToAI} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Descreva a sua ideia (ex: 'quero um suporte de fone resistente'...)"
                        value={aiInputText}
                        onChange={(e) => setAiInputText(e.target.value)}
                        className="flex-grow bg-[#09090b] border border-[#18181b] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                      <button
                        type="submit"
                        disabled={aiLoading}
                        className="px-6 py-2 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                      >
                        Enviar
                      </button>
                    </form>
                  </div>
                )}


              </div>

            </div>
          </div>
        )}

        {/* TAB 3: PORTAL MAKER — outro role vê gate; visitante/MAKER vê wizard ou painel */}
        {activeTab === "maker" && currentUser && currentUser.role !== "MAKER" && (
          <div className="max-w-lg mx-auto px-6 py-20 text-center space-y-5">
            <div className={`rounded-2xl border p-8 space-y-4 ${
              theme === "dark" ? "border-[#18181b] bg-[#09090b]/40" : "border-[#ebebef] bg-white"
            }`}>
              <Icon name="precision_manufacturing" size={36} className="text-[#d44d00] mx-auto" />
              <h2 className={`text-xl font-bold tracking-tight ${theme === "dark" ? "text-white" : "text-[#111]"}`}>
                Portal da fab
              </h2>
              <p className={`text-sm ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#5c5c66]"}`}>
                A fila de jobs é só para makers homologados.
                {` Sua sessão atual (${currentUser.role}) não tem permissão.`}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  type="button"
                  onClick={openMakerLogin}
                  className="px-6 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white text-xs font-bold uppercase tracking-wider rounded-full transition cursor-pointer"
                >
                  Entrar como maker
                </button>
                <button
                  type="button"
                  onClick={() => goTo("home", "maker")}
                  className={`px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-full border transition cursor-pointer ${
                    theme === "dark"
                      ? "border-white/15 text-white hover:bg-white/5"
                      : "border-black/10 text-[#111] hover:bg-black/5"
                  }`}
                >
                  Voltar ao início
                </button>
              </div>
              <p className="text-[10px] text-[#71717a] mono-text pt-2">MVP: roda@fabmakers.com.br / 123</p>
            </div>
          </div>
        )}

        {activeTab === "maker" && (!currentUser || currentUser.role === "MAKER") && (
          <div className="max-w-7xl mx-auto px-6 py-12">
{/* 1. SE O MAKER NÃO ESTÁ CADASTRADO: WIZARD DE CREDENCIAMENTO */}
            {!makerProfile ? (
              <div className="max-w-xl mx-auto space-y-10 py-4">
                {(() => {
                  const wizardSteps = [
                    { n: 1, label: "Conta" },
                    { n: 2, label: "Contrato" },
                    { n: 3, label: "Máquinas" },
                    { n: 4, label: "Estoque" },
                    { n: 5, label: "KYC" },
                  ];
                  const isLight = theme === "light";
                  const labelCls = isLight
                    ? "text-[12px] font-medium text-[var(--wizard-muted)]"
                    : "text-[10px] uppercase tracking-wider text-[#71717a] mono-text";
                  const titleCls = isLight ? "text-[#111111]" : "text-white";
                  const bodyCls = isLight ? "text-[#5c5c66] leading-relaxed" : "text-[#a1a1aa]";
                  const btnBack = isLight
                    ? "flex-1 py-3.5 border border-[#e4e4ea] text-[#111] font-semibold text-sm rounded-full transition hover:bg-white cursor-pointer"
                    : "flex-1 py-3 border border-[#18181b] text-white font-bold text-xs uppercase tracking-wider rounded-md transition cursor-pointer hover:border-[#27272a]";
                  const btnNext = isLight
                    ? "flex-1 py-3.5 bg-[#111111] text-white font-semibold text-sm rounded-full transition hover:bg-[#2a2a2a] cursor-pointer"
                    : "flex-1 py-3 bg-white text-black font-bold text-xs uppercase tracking-wider rounded-md transition cursor-pointer hover:bg-[#e4e4e7]";
                  const btnNextDisabled = isLight
                    ? "flex-1 py-3.5 bg-[#ebebef] text-[#9a9aa3] font-semibold text-sm rounded-full cursor-not-allowed"
                    : "flex-1 py-3 bg-[#18181b] border border-[#27272a] text-[#71717a] font-bold text-xs uppercase tracking-wider rounded-md cursor-not-allowed";
                  const btnAccent = "w-full py-3.5 bg-[#d44d00] hover:bg-[#b04000] text-white text-sm font-semibold rounded-full transition cursor-pointer";
                  return (
                <>
                <div className="space-y-8 text-center sm:text-left">
                  <div className="space-y-3">
                    <p className={`text-[11px] font-medium tracking-[0.18em] uppercase ${isLight ? "text-[#d44d00]" : "text-[#d44d00]"}`}>
                      Credenciamento
                    </p>
                    <h2 className={`text-3xl sm:text-4xl font-semibold tracking-tight ${titleCls}`}>
                      Cadastre sua fab
                    </h2>
                    <p className={`text-[15px] max-w-md mx-auto sm:mx-0 ${bodyCls}`}>
                      Confirme a conta, aceite o contrato, declare máquinas e estoque, e prove identidade + calibração para entrar na fila de jobs.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className={`flex justify-between text-[12px] ${isLight ? "text-[#8a8a93]" : "text-[#71717a] mono-text uppercase tracking-wider text-[10px]"}`}>
                      <span>Passo {wizardStep} de 5</span>
                      <span>{wizardSteps[wizardStep - 1]?.label}</span>
                    </div>
                    <div className={`h-1 rounded-full overflow-hidden ${isLight ? "bg-[#e8e8ee]" : "bg-[#18181b]"}`}>
                      <div
                        className="h-full bg-[#d44d00] transition-all duration-500 ease-out rounded-full"
                        style={{ width: `${(wizardStep / 5) * 100}%` }}
                      />
                    </div>
                    <ol className="grid grid-cols-5 gap-1">
                      {wizardSteps.map((s) => (
                        <li
                          key={s.n}
                          className={`text-center text-[11px] font-medium truncate ${
                            s.n === wizardStep
                              ? "text-[#d44d00]"
                              : s.n < wizardStep
                                ? titleCls
                                : isLight ? "text-[#b0b0b8]" : "text-[#52525b]"
                          }`}
                        >
                          {s.label}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>

                <div className={`rounded-2xl p-7 sm:p-9 space-y-8 ${
                  isLight
                    ? "bg-white border border-[#ebebef] shadow-[0_8px_30px_rgba(0,0,0,0.04)]"
                    : "border border-[#18181b] bg-[#09090b]/80"
                }`}>
                  {/* PASSO 1: CONTA + IDENTIDADE LOCAL */}
                  {wizardStep === 1 && (
                    <div className="space-y-7">
                      <div className={`space-y-1.5 pb-4 border-b ${isLight ? "border-[#f0f0f3]" : "border-[#18181b]"}`}>
                        <h3 className={`text-lg font-semibold tracking-tight ${titleCls}`}>Conta e localização</h3>
                        <p className={`text-sm ${bodyCls}`}>Confirme o e-mail da sessão e diga quem você é e de onde fabrica.</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelCls}>E-mail da sessão</label>
                        <input
                          type="email" value={wizardEmail} disabled
                          className="wizard-input"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5" id="wizard-field-name">
                          <label className={labelCls}>Nome completo</label>
                          <input
                            type="text"
                            value={wizardName}
                            onChange={(e) => {
                              setWizardName(e.target.value);
                              setWizardErrors((prev) => {
                                const n = { ...prev };
                                delete n.name;
                                return n;
                              });
                            }}
                            placeholder="Como no documento"
                            className={`wizard-input ${wizardErrors.name ? "wizard-input-error" : ""}`}
                          />
                          {wizardErrors.name && <p className="text-[12px] text-red-500 font-medium">{wizardErrors.name}</p>}
                        </div>
                        <div className="space-y-1.5" id="wizard-field-zip">
                          <label className={labelCls}>CEP de atuação</label>
                          <input
                            type="text"
                            value={wizardZip}
                            onChange={(e) => {
                              handleMakerZipChange(e.target.value);
                              setWizardErrors((prev) => {
                                const n = { ...prev };
                                delete n.zip;
                                return n;
                              });
                            }}
                            placeholder="00000-000"
                            className={`wizard-input ${wizardErrors.zip ? "wizard-input-error" : ""}`}
                          />
                          {wizardErrors.zip && <p className="text-[12px] text-red-500 font-medium">{wizardErrors.zip}</p>}
                          {makerZipLoading && <p className="text-xs text-amber-600 animate-pulse">Buscando localidade...</p>}
                          {makerZipFeedback && <p className="text-xs text-[#0d9f6e] font-medium mt-0.5">{makerZipFeedback}</p>}
                        </div>
                      </div>

                      <div className="wizard-nest space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className={`font-medium ${isLight ? "text-[#5c5c66]" : "text-[#a1a1aa] uppercase text-xs mono-text tracking-wider"}`}>E-mail</span>
                          <span className={emailVerified ? "text-[#0d9f6e] font-medium" : "text-amber-600 font-medium"}>
                            {emailVerified ? "Confirmado" : "Pendente"}
                          </span>
                        </div>
                        <p className={`text-sm ${bodyCls}`}>
                          Enviamos um código de 6 dígitos. Sem SMTP no ambiente, o código aparece aqui (modo console).
                        </p>

                        {!emailVerified ? (
                          <div className="space-y-3">
                            <button
                              type="button"
                              disabled={emailVerificationLoading}
                              onClick={async () => {
                                if (!wizardEmail) {
                                  alert("E-mail da sessão não identificado. Faça login novamente.");
                                  return;
                                }
                                setEmailVerificationLoading(true);
                                try {
                                  const res = await fetch("/api/auth/verify-email", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "send", email: wizardEmail }),
                                  });
                                  const data = await res.json();
                                  if (!data.success) {
                                    alert(data.error || "Falha ao enviar código.");
                                    return;
                                  }
                                  setEmailSent(true);
                                  if (data.devCode) {
                                    setRealGeneratedCode(data.devCode);
                                    setEmailVerificationCode(data.devCode);
                                  } else {
                                    setRealGeneratedCode("");
                                    setEmailVerificationCode("");
                                  }
                                  setWizardErrors((prev) => {
                                    const n = { ...prev };
                                    delete n.email;
                                    return n;
                                  });
                                } catch (err) {
                                  console.error(err);
                                  alert("Erro de conexão ao enviar código.");
                                } finally {
                                  setEmailVerificationLoading(false);
                                }
                              }}
                              className={btnAccent}
                            >
                              {emailVerificationLoading ? "Enviando…" : "Enviar código de verificação"}
                            </button>

                            {emailSent && (
                              <div className="space-y-2">
                                {realGeneratedCode ? (
                                  <div className={`rounded-xl p-4 text-center ${isLight ? "bg-white border border-[#ebebef]" : "bg-[#18181b] border border-[#d44d00]/40"}`}>
                                    <span className={`text-[11px] block mb-1 ${isLight ? "text-[#8a8a93]" : "text-[#71717a] uppercase"}`}>Código (modo console)</span>
                                    <span className="text-xl font-semibold text-[#d44d00] tracking-[0.25em]">{realGeneratedCode}</span>
                                  </div>
                                ) : (
                                  <p className={`text-xs ${isLight ? "text-[#5c5c66]" : "text-[#a1a1aa]"}`}>
                                    Verifique sua caixa de entrada e digite o código abaixo.
                                  </p>
                                )}
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="Código"
                                    value={emailVerificationCode}
                                    onChange={(e) => setEmailVerificationCode(e.target.value)}
                                    className="wizard-input text-center tracking-widest font-semibold"
                                  />
                                  <button
                                    type="button"
                                    disabled={emailVerificationLoading}
                                    onClick={async () => {
                                      if (!wizardEmail || !emailVerificationCode) {
                                        alert("Informe o código.");
                                        return;
                                      }
                                      setEmailVerificationLoading(true);
                                      try {
                                        const res = await fetch("/api/auth/verify-email", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            action: "confirm",
                                            email: wizardEmail,
                                            code: emailVerificationCode,
                                          }),
                                        });
                                        const data = await res.json();
                                        if (!data.success) {
                                          alert(data.error || "Código inválido.");
                                          return;
                                        }
                                        setEmailVerified(true);
                                        setWizardErrors((prev) => {
                                          const n = { ...prev };
                                          delete n.email;
                                          return n;
                                        });
                                      } catch (err) {
                                        console.error(err);
                                        alert("Erro ao validar código.");
                                      } finally {
                                        setEmailVerificationLoading(false);
                                      }
                                    }}
                                    className="px-5 rounded-full bg-[#0d9f6e] hover:bg-[#0b8a5f] text-white text-sm font-semibold transition cursor-pointer"
                                  >
                                    Validar
                                  </button>
                                </div>
                              </div>
                            )}

                            <details className={`pt-2 ${isLight ? "border-t border-[#ebebef]" : "border-t border-[#18181b]"}`}>
                              <summary className={`text-[12px] cursor-pointer select-none py-2 ${isLight ? "text-[#8a8a93]" : "text-[#71717a] uppercase tracking-wider mono-text"}`}>
                                MVP — confirmar e-mail da sessão (sem código)
                              </summary>
                              <button
                                type="button"
                                onClick={() => {
                                  setEmailSent(true);
                                  setEmailVerified(true);
                                  setWizardErrors((prev) => {
                                    const n = { ...prev };
                                    delete n.email;
                                    return n;
                                  });
                                }}
                                className={`${btnBack} mt-2 w-full`}
                              >
                                Confirmar e-mail da sessão
                              </button>
                            </details>
                          </div>
                        ) : (
                          <p className={`text-sm font-medium ${isLight ? "text-[#0d9f6e]" : "text-[#10b981]"}`}>
                            E-mail verificado — pode seguir o cadastro.
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setWizardStep(2)}
                        disabled={!emailVerified}
                        className={!emailVerified ? btnNextDisabled : (isLight ? `${btnNext} w-full` : `w-full py-3 font-bold text-xs uppercase tracking-wider rounded-md transition bg-white text-black hover:bg-[#e4e4e7] cursor-pointer`)}
                      >
                        Continuar
                      </button>
                    </div>
                  )}

                  {/* PASSO 2: CONTRATO SLA */}
                  {wizardStep === 2 && (
                    <div className="space-y-7">
                      <div className={`space-y-1.5 pb-4 border-b ${isLight ? "border-[#f0f0f3]" : "border-[#18181b]"}`}>
                        <h3 className={`text-lg font-semibold tracking-tight ${titleCls}`}>Contrato de credenciamento</h3>
                        <p className={`text-sm ${bodyCls}`}>Leia os termos. Sem vínculo empregatício — você fabrica, a plataforma orquestra.</p>
                      </div>
                      
                      {/* Corpo do Contrato */}
                      <div className={`h-56 overflow-y-auto p-5 space-y-4 text-sm leading-relaxed rounded-2xl ${
                        isLight ? "bg-[#fafafa] border border-[#ebebef] text-[#5c5c66]" : "border border-[#18181b] bg-[#050506] text-[#a1a1aa]"
                      }`}>
                        <h4 className={`text-xs font-semibold tracking-wide ${titleCls}`}>1. Da natureza da intermediação digital P2P</h4>
                        <p>
                          A FAB MAKERS atua exclusivamente como provedora de infraestrutura tecnológica e de intermediação comercial. A plataforma conecta de forma algorítmica a lei da oferta e da procura: de um lado, clientes demandantes de peças customizadas; de outro, Makers (Pessoas Físicas operando hardware ocioso doméstico ou Empresas/Bureaus corporativos de manufatura). O Maker declara estar ciente de que não há qualquer vínculo empregatício ou societário com a FAB MAKERS.
                        </p>
                        
                        <h4 className={`text-xs font-semibold tracking-wide ${titleCls}`}>2. Da taxa de intermediação e comissão</h4>
                        <p className={`font-medium ${titleCls}`}>
                          O credenciamento na plataforma é 100% gratuito. Pela intermediação tecnológica e facilitação de cobrança, a FAB MAKERS aplicará taxas e comissões flexíveis de acordo com o plano de maker e a complexidade de cada projeto, previamente detalhadas e informadas no momento do aceite de cada proposta de trabalho. O repasse financeiro do valor líquido acordado será depositado de forma digital e quinzenal na conta bancária do parceiro cadastrado.
                        </p>

                        <h4 className={`text-xs font-semibold tracking-wide ${titleCls}`}>3. Da isenção de responsabilidade fiscal e hardware</h4>
                        <p>
                          O Maker assume inteira e exclusiva responsabilidade pelos custos de hardware de sua operação (energia elétrica, depreciação física de bicos/extrusoras, compra de filamentos, falhas de impressão e perdas de material). A FAB MAKERS atua apenas na facilitação do pagamento. A nota fiscal dos insumos e produtos comprados via dropshipping é de responsabilidade do fornecedor original, cabendo ao Maker a regularização de seus serviços de fabricação perante os órgãos tributários.
                        </p>

                        <h4 className={`text-xs font-semibold tracking-wide ${titleCls}`}>4. Do sigilo dos arquivos e propriedade intelectual</h4>
                        <p className={`font-medium ${titleCls}`}>
                          Os arquivos geométricos (STL, OBJ, STEP, etc.) enviados pelos clientes são de propriedade intelectual exclusiva dos mesmos. O Maker obriga-se a manter sigilo absoluto sobre tais arquivos, comprometendo-se a deletá-los de seus sistemas e fatiadores locais logo após a conclusão física e despacho da ordem. É expressamente proibido revender, distribuir, arquivar ou reproduzir as peças dos clientes para fins comerciais próprios. O descumprimento gera banimento imediato e instauração de responsabilidade civil e criminal.
                        </p>

                        <h4 className={`text-xs font-semibold tracking-wide ${titleCls}`}>5. Da não concorrência e canal exclusivo</h4>
                        <p>
                          Fica vedado ao Maker negociar diretamente ou receber pagamentos por fora dos clientes apresentados originalmente pela FAB MAKERS. O desvio de canal ensejará multa correspondente ao triplo da média de faturamento mensal do parceiro, além do bloqueio permanente e retenção de saldos para indenização de prejuízos.
                        </p>
                      </div>

                      {/* Caixa de Aceite */}
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input 
                          type="checkbox" checked={contractAccepted} 
                          onChange={(e) => setContractAccepted(e.target.checked)} 
                          className="mt-1 accent-[#d44d00] scale-110" 
                        />
                        <span className={`text-sm leading-snug ${bodyCls}`}>
                          Declaro que li, compreendi e concordo com todos os termos do Contrato de Credenciamento da FAB MAKERS, assumindo total responsabilidade pelo sigilo das peças 3D e calibração dimensional.
                        </span>
                      </label>

                      <div className="flex gap-3">
                        <button type="button" onClick={() => setWizardStep(1)} className={btnBack}>
                          Voltar
                        </button>
                        <button 
                          type="button"
                          onClick={() => setWizardStep(3)} 
                          disabled={!contractAccepted}
                          className={contractAccepted ? btnNext : btnNextDisabled}
                        >
                          Continuar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASSO 3: MÁQUINAS */}
                  {wizardStep === 3 && (
                    <div className="space-y-7">
                      <div className={`space-y-1.5 pb-4 border-b ${isLight ? "border-[#f0f0f3]" : "border-[#18181b]"}`}>
                        <h3 className={`text-lg font-semibold tracking-tight ${titleCls}`}>Suas impressoras</h3>
                        <p className={`text-sm ${bodyCls}`}>Declare o hardware ocioso que vai receber jobs da fila.</p>
                      </div>
                      {(wizardErrors.machines) && (
                        <p className="text-[12px] text-red-500 font-medium">{wizardErrors.machines}</p>
                      )}

                      {/* Lista de Máquinas */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className={labelCls}>Equipamentos</label>
                          <button type="button" onClick={addMachine} className="text-sm text-[#d44d00] hover:opacity-80 font-semibold">+ Adicionar</button>
                        </div>
                        
                        {wizardMachines.map((mach, index) => {
                          const filteredModels = PRINTER_PRESETS.filter(p => p.brand === mach.brand).map(p => p.model);
                          const isCustom = !mach.brand || mach.brand === "Personalizada";
                          
                          return (
                            <div key={mach.id} className="wizard-nest space-y-4">
                              <div className={`flex justify-between items-center text-sm pb-2 border-b ${isLight ? "border-[#ebebef]" : "border-[#18181b]"}`}>
                                <span className={`font-medium ${isLight ? "text-[#5c5c66]" : "text-[#71717a] mono-text text-xs tracking-wider"}`}>Máquina #{index + 1}</span>
                                {wizardMachines.length > 1 && (
                                  <button 
                                    onClick={() => setWizardMachines(wizardMachines.filter(m => m.id !== mach.id))}
                                    className="text-red-500 hover:text-red-400 font-medium text-xs"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className={labelCls}>Fabricante</label>
                                  <select 
                                    value={mach.brand || ""} 
                                    onChange={(e) => {
                                      const newM = [...wizardMachines];
                                      newM[index].brand = e.target.value;
                                      newM[index].model = ""; // limpa modelo anterior
                                      if (e.target.value === "Personalizada") {
                                        newM[index].volume = "220x220x250mm";
                                        newM[index].nozzle = "0.4mm";
                                        newM[index].technology = "FDM";
                                        newM[index].hasEnclosure = false;
                                        newM[index].hasMulticolor = false;
                                        newM[index].maxNozzleTemp = 260;
                                        newM[index].maxBedTemp = 100;
                                        newM[index].compatibleMaterials = ["PLA", "PETG", "TPU"];
                                        newM[index].supportedNozzles = ["0.4mm"];
                                        newM[index].typicalPrecision = 0.1;
                                        newM[index].maxSpeed = 100;
                                        newM[index].maxPartWeightG = 1000;
                                        newM[index].releaseYear = 2026;
                                        newM[index].status = "ACTIVE";
                                      }
                                      setWizardMachines(newM);
                                    }}
                                    className="wizard-select" 
                                  >
                                    <option value="">-- Selecione a marca --</option>
                                    {uniqueBrands.map(b => (
                                      <option key={b} value={b}>{b}</option>
                                    ))}
                                    <option value="Personalizada">Outra / Personalizada</option>
                                  </select>
                                </div>

                                {!isCustom && (
                                  <div className="space-y-1">
                                    <label className={labelCls}>Modelo</label>
                                    <select 
                                      value={mach.model || ""} 
                                      onChange={(e) => {
                                        const preset = PRINTER_PRESETS.find(p => p.brand === mach.brand && p.model === e.target.value);
                                        if (preset) {
                                          const newM = [...wizardMachines];
                                          newM[index].model = preset.model;
                                          newM[index].volume = `${preset.volumeX}x${preset.volumeY}x${preset.volumeZ}mm`;
                                          newM[index].technology = preset.technology;
                                          newM[index].hasEnclosure = preset.hasEnclosure;
                                          newM[index].hasMulticolor = preset.hasMulticolor;
                                          newM[index].maxNozzleTemp = preset.maxNozzleTemp;
                                          newM[index].maxBedTemp = preset.maxBedTemp;
                                          newM[index].compatibleMaterials = preset.compatibleMaterials;
                                          newM[index].supportedNozzles = preset.supportedNozzles;
                                          newM[index].typicalPrecision = preset.typicalPrecision;
                                          newM[index].maxSpeed = preset.maxSpeed;
                                          newM[index].maxPartWeightG = preset.maxPartWeightG;
                                          newM[index].releaseYear = preset.releaseYear;
                                          newM[index].status = preset.status;
                                          setWizardMachines(newM);
                                        }
                                      }}
                                      className="wizard-select"
                                    >
                                      <option value="">-- Selecione o modelo --</option>
                                      {filteredModels.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>

                              {isCustom ? (
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                  <div className="space-y-1">
                                    <label className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text">Fabricante Livre</label>
                                    <input 
                                      type="text" value={mach.brand === "Personalizada" ? "" : mach.brand} placeholder="Ex: Creality"
                                      onChange={(e) => {
                                        const newM = [...wizardMachines];
                                        newM[index].brand = e.target.value;
                                        setWizardMachines(newM);
                                      }}
                                      className="wizard-input"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className={labelCls}>Modelo livre</label>
                                    <input 
                                      type="text" value={mach.model} placeholder="Ex: Ender 3 V2"
                                      onChange={(e) => {
                                        const newM = [...wizardMachines];
                                        newM[index].model = e.target.value;
                                        setWizardMachines(newM);
                                      }}
                                      className="wizard-input"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className={labelCls}>Volume (XxYxZ)</label>
                                    <input 
                                      type="text" value={mach.volume} placeholder="Ex: 220x220x250mm"
                                      onChange={(e) => {
                                        const newM = [...wizardMachines];
                                        newM[index].volume = e.target.value;
                                        setWizardMachines(newM);
                                      }}
                                      className="wizard-input"
                                    />
                                  </div>
                                </div>
                              ) : (
                                mach.model && (
                                  <div className="wizard-spec space-y-2">
                                    <div className="grid grid-cols-3 gap-y-1.5 gap-x-2">
                                      <p>Tecnologia: <span className={titleCls}>{mach.technology}</span></p>
                                      <p>Volume: <span className={titleCls}>{mach.volume}</span></p>
                                      <p>Câmara: <span className={titleCls}>{mach.hasEnclosure ? "Fechada" : "Aberta"}</span></p>
                                      <p>Multicor: <span className={titleCls}>{mach.hasMulticolor ? "Sim" : "Não"}</span></p>
                                      <p>Bico máx: <span className={titleCls}>{mach.maxNozzleTemp}°C</span></p>
                                      <p>Mesa máx: <span className={titleCls}>{mach.maxBedTemp}°C</span></p>
                                      <p>Velocidade: <span className={titleCls}>{mach.maxSpeed} mm/s</span></p>
                                      <p>Precisão: <span className={titleCls}>±{mach.typicalPrecision} mm</span></p>
                                      <p>Carga Z: <span className={titleCls}>{mach.maxPartWeightG}g</span></p>
                                    </div>
                                    <div className={`border-t pt-1.5 text-xs ${isLight ? "border-[#ebebef]" : "border-[#18181b]"}`}>
                                      <p className="truncate">Materiais: <span className={titleCls}>{(mach.compatibleMaterials || []).join(", ")}</span></p>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-3">
                        <button type="button" onClick={() => setWizardStep(2)} className={btnBack}>
                          Voltar
                        </button>
                        <button type="button" onClick={() => setWizardStep(4)} className={btnNext}>
                          Continuar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASSO 4: INSUMOS */}
                  {wizardStep === 4 && (
                    <div className="space-y-7">
                      <div className={`space-y-1.5 pb-4 border-b ${isLight ? "border-[#f0f0f3]" : "border-[#18181b]"}`}>
                        <h3 className={`text-lg font-semibold tracking-tight ${titleCls}`}>Estoque de filamento</h3>
                        <p className={`text-sm ${bodyCls}`}>O que você tem pronto para imprimir agora.</p>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className={labelCls}>Materiais</label>
                          <button type="button" onClick={addFilament} className="text-sm text-[#d44d00] hover:opacity-80 font-semibold">+ Adicionar</button>
                        </div>
                        {wizardFilaments.map((fil, index) => (
                          <div key={fil.id} className="wizard-nest grid grid-cols-3 gap-2 !py-3">
                            <select 
                              value={fil.type} 
                              onChange={(e) => {
                                const newF = [...wizardFilaments];
                                newF[index].type = e.target.value;
                                setWizardFilaments(newF);
                              }}
                              className="wizard-select"
                            >
                              <option value="PLA">PLA</option>
                              <option value="ABS">ABS</option>
                              <option value="PETG">PETG</option>
                              <option value="Nylon CF">Nylon CF</option>
                              <option value="Resina">Resina Tough</option>
                            </select>
                            <input 
                              type="text" value={fil.color} placeholder="Cor" 
                              onChange={(e) => {
                                const newF = [...wizardFilaments];
                                newF[index].color = e.target.value;
                                setWizardFilaments(newF);
                              }}
                              className="wizard-input !py-2.5" 
                            />
                            <input 
                              type="number" value={fil.weightG} placeholder="Gramas" 
                              onChange={(e) => {
                                const newF = [...wizardFilaments];
                                newF[index].weightG = parseInt(e.target.value) || 0;
                                setWizardFilaments(newF);
                              }}
                              className="wizard-input !py-2.5" 
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-3">
                        <button type="button" onClick={() => setWizardStep(3)} className={btnBack}>
                          Voltar
                        </button>
                        <button type="button" onClick={() => setWizardStep(5)} className={btnNext}>
                          Continuar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASSO 5: AGENDA, KYC E CALIBRAÇÃO */}
                  {wizardStep === 5 && (
                    <div className="space-y-8">
                      <div className={`space-y-1.5 pb-4 border-b ${theme === "light" ? "border-[#f0f0f3]" : "border-[#18181b]"}`}>
                        <h3 className={`text-lg font-semibold tracking-tight ${theme === "light" ? "text-[#111]" : "text-white"}`}>Disponibilidade, identidade e calibração</h3>
                        <p className={`text-sm ${theme === "light" ? "text-[#5c5c66]" : "text-[#71717a]"}`}>Último passo antes da homologação — quando você imprime, quem você é, e prova dimensional.</p>
                      </div>
                      
                      {/* Calendário interativo de escala */}
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">Dias disponíveis</label>
                        
                        <div className="grid grid-cols-7 gap-2 text-center text-xs">
                          {["seg", "ter", "qua", "qui", "sex", "sab", "dom"].map((day) => (
                            <div key={day} className="space-y-2">
                              <span className="font-bold text-[#a1a1aa] uppercase tracking-widest text-xs mono-text">{day}</span>
                              <button 
                                onClick={() => {
                                  const isEscalado = wizardDays.includes(day);
                                  toggleDay(day);
                                  setWizardDailyHours(prev => ({
                                    ...prev,
                                    [day]: isEscalado ? 0 : 8
                                  }));
                                }}
                                className={`w-full py-2.5 border rounded-xl font-medium text-[11px] transition cursor-pointer ${
                                  wizardDays.includes(day)
                                    ? (theme === "light" ? "border-[#d44d00]/50 bg-[#d44d00]/8 text-[#111]" : "border-[#d44d00] bg-[#d44d00]/5 text-white")
                                    : (theme === "light" ? "border-[#e4e4ea] bg-white text-[#8a8a93]" : "border-[#18181b] bg-[#050506] text-[#71717a]")
                                }`}
                              >
                                {wizardDays.includes(day) ? "On" : "Off"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Ajuste de horas da máquina por dia da semana */}
                      {wizardDays.length > 0 && (
                        <div className="space-y-4 border-t border-[#18181b] pt-4">
                          <label className="text-xs uppercase tracking-wider text-[#71717a] mono-text block">Capacidade Horária por Dia (Carga Máquina)</label>
                          <div className="space-y-2">
                            {wizardDays.map((day) => (
                              <div key={day} className={`flex justify-between items-center gap-4 p-3 rounded-xl text-sm ${
                                theme === "light" ? "bg-[#fafafa] border border-[#ebebef]" : "bg-[#09090b] border border-[#18181b] text-xs"
                              }`}>
                                <span className={`font-medium uppercase w-12 ${theme === "light" ? "text-[#111]" : "text-white mono-text"}`}>{day}</span>
                                <input 
                                  type="range" min="1" max="24" step="1"
                                  value={wizardDailyHours[day] !== undefined ? wizardDailyHours[day] : 8}
                                  onChange={(e) => {
                                    setWizardDailyHours(prev => ({
                                      ...prev,
                                      [day]: parseInt(e.target.value)
                                    }));
                                  }}
                                  className={`flex-1 accent-[#d44d00] h-1 rounded-lg appearance-none cursor-pointer ${theme === "light" ? "bg-[#e8e8ee]" : "bg-[#18181b]"}`}
                                />
                                <span className="text-[#d44d00] font-semibold w-16 text-right text-sm">
                                  {wizardDailyHours[day] !== undefined ? wizardDailyHours[day] : 8}h
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Mostrador de Capacidade Máquina Total Semanal */}
                          <div className="bg-[#10b981]/5 border border-[#10b981]/15 p-4 rounded-md space-y-1 mono-text text-xs text-[#10b981]">
                            <div className="flex justify-between items-center font-bold">
                              <span>Capacidade semanal</span>
                              <span>
                                {wizardDays.reduce((acc, d) => acc + (wizardDailyHours[d] || 8), 0) * wizardMachines.length}h
                              </span>
                            </div>
                            <p className="text-[10px] text-[#71717a] font-normal normal-case">
                              {wizardMachines.length} máquina(s) × horas declaradas.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-[#18181b] pt-6 space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">Identidade (KYC)</label>
                          <p className="text-xs text-[#71717a]">Documento + selfie. O nome abaixo deve bater com o do passo 1.</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className={`space-y-1.5 rounded-md p-2 ${wizardErrors.kycDoc ? "ring-2 ring-red-500/50 border border-red-500 bg-red-500/5" : ""}`}>
                            <span className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">RG ou CNH</span>
                            <div className="flex items-center gap-2">
                              <label className={`wizard-file-btn ${
                                wizardErrors.kycDoc ? "border-red-500 text-red-500" : ""
                              }`}>
                                Selecionar
                                <input 
                                  type="file" accept="image/*" className="hidden" 
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      setKycDocumentName(e.target.files[0].name);
                                      setWizardErrors(prev => { const n = { ...prev }; delete n.kycDoc; return n; });
                                    }
                                  }} 
                                />
                              </label>
                              <span className={`text-xs truncate max-w-[140px] ${kycDocumentName ? "text-[#10b981]" : "text-[#71717a]"}`}>
                                {kycDocumentName || "Nenhum arquivo"}
                              </span>
                            </div>
                            {wizardErrors.kycDoc && <p className="text-[10px] text-red-400 font-bold">{wizardErrors.kycDoc}</p>}
                          </div>

                          <div className={`space-y-1.5 rounded-md p-2 ${wizardErrors.kycSelfie ? "ring-2 ring-red-500/50 border border-red-500 bg-red-500/5" : ""}`}>
                            <span className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">Selfie com documento</span>
                            <div className="flex items-center gap-2">
                              <label className={`wizard-file-btn ${
                                wizardErrors.kycSelfie ? "border-red-500 text-red-500" : ""
                              }`}>
                                Anexar
                                <input 
                                  type="file" accept="image/*" className="hidden" 
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      setKycSelfieName(e.target.files[0].name);
                                      setWizardErrors(prev => { const n = { ...prev }; delete n.kycSelfie; return n; });
                                    }
                                  }} 
                                />
                              </label>
                              <span className={`text-xs truncate max-w-[140px] ${kycSelfieName ? "text-[#10b981]" : "text-[#71717a]"}`}>
                                {kycSelfieName || "Nenhum arquivo"}
                              </span>
                            </div>
                            {wizardErrors.kycSelfie && <p className="text-[10px] text-red-400 font-bold">{wizardErrors.kycSelfie}</p>}
                          </div>
                        </div>
                        
                        {kycDocumentName && kycSelfieName && (
                          <div className="p-4 rounded-md bg-[#09090b] border border-[#18181b] space-y-3">
                            <div className="flex justify-between items-center text-xs mono-text">
                              <span className="text-[#10b981] font-bold uppercase tracking-wider">Pré-checagem</span>
                              <span className="text-[#71717a]">MVP · simulado</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="space-y-1 bg-[#050506] border border-[#18181b] p-2.5 rounded-md">
                                <span className="text-[#71717a] block">Face match</span>
                                <span className="text-[#10b981] font-bold block mt-0.5">Documento + selfie anexados</span>
                              </div>
                              <div className="space-y-1 bg-[#050506] border border-[#18181b] p-2.5 rounded-md">
                                <span className="text-[#71717a] block">Nome cadastrado</span>
                                <span className="text-white font-bold block mt-0.5">
                                  {wizardName.trim() || currentUser?.name || "Preencha o nome no passo 1"}
                                </span>
                              </div>
                            </div>
                            <p className="text-[10px] text-[#71717a] leading-relaxed">
                              Sem OCR real neste MVP — o nome acima é o que você digitou. A homologação final é do admin.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-[#18181b] pt-6 space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">Calibração (cubo 20 mm)</label>
                          <p className="text-xs text-[#71717a] leading-relaxed">
                            Imprima o cubo de teste, meça com paquímetro (X/Y/Z) e anexe a foto. Tolerância: ±0,05 mm.
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">Eixo X (mm)</span>
                            <input 
                              type="number" step="0.01" value={calibX} 
                              onChange={(e) => setCalibX(parseFloat(e.target.value) || 20.00)}
                              className="wizard-input" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">Eixo Y (mm)</span>
                            <input 
                              type="number" step="0.01" value={calibY} 
                              onChange={(e) => setCalibY(parseFloat(e.target.value) || 20.00)}
                              className="wizard-input" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">Eixo Z (mm)</span>
                            <input 
                              type="number" step="0.01" value={calibZ} 
                              onChange={(e) => setCalibZ(parseFloat(e.target.value) || 20.00)}
                              className="wizard-input" 
                            />
                          </div>
                        </div>

                        <div className={`space-y-1.5 rounded-md p-2 ${wizardErrors.calibPhoto ? "ring-2 ring-red-500/50 border border-red-500 bg-red-500/5" : ""}`}>
                          <span className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">Foto da medição (paquímetro)</span>
                          <div className="flex items-center gap-2">
                            <label className={`wizard-file-btn ${
                              wizardErrors.calibPhoto ? "border-red-500 text-red-500" : ""
                            }`}>
                              Anexar foto
                              <input 
                                type="file" accept="image/*" className="hidden" 
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    setCalibImageName(e.target.files[0].name);
                                    setWizardErrors(prev => { const n = { ...prev }; delete n.calibPhoto; return n; });
                                  }
                                }} 
                              />
                            </label>
                            <span className={`text-xs truncate max-w-[200px] ${calibImageName ? "text-[#10b981]" : "text-[#71717a]"}`}>
                              {calibImageName || "Nenhum arquivo"}
                            </span>
                          </div>
                          {wizardErrors.calibPhoto && <p className="text-[10px] text-red-400 font-bold">{wizardErrors.calibPhoto}</p>}
                        </div>
                      </div>

                      {Object.keys(wizardErrors).length > 0 && (
                        <div
                          ref={wizardErrorBannerRef}
                          className="border border-red-500/40 bg-red-500/10 p-4 rounded-md space-y-2"
                          role="alert"
                        >
                          <p className="text-xs font-bold text-red-400 uppercase tracking-wider mono-text">
                            Falta preencher para concluir
                          </p>
                          <ul className="text-xs text-red-300 space-y-1 list-disc pl-4">
                            {Object.values(wizardErrors).map((msg) => (
                              <li key={msg}>{msg}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button type="button" onClick={() => setWizardStep(4)} className={btnBack}>
                          Voltar
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRegisterMaker()}
                          className={btnAccent}
                        >
                          Solicitar homologação
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                </>
                  );
                })()}
              </div>
            ) : (
              // 2. SE O MAKER JÁ TEM CADASTRO
              <div className="space-y-8">
                
                {/* Cabeçalho do Maker Cadastrado com status Sandbox */}
                <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl border ${
                  theme === "light"
                    ? "bg-white border-[#ebebef] shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
                    : "bg-[#09090b] border-[#18181b]"
                }`}>
                  <div>
                    <h2 className={`text-lg font-semibold tracking-tight ${theme === "light" ? "text-[#111]" : "text-white mono-text"}`}>{makerProfile.name}</h2>
                    <p className={`text-xs mt-1 ${theme === "light" ? "text-[#8a8a93]" : "text-[#71717a]"}`}>
                      CEP de atuação: <span className={theme === "light" ? "text-[#5c5c66] font-medium" : "text-[#a1a1aa]"}>{makerProfile.zipCode || "—"}</span>
                    </p>
                  </div>
                  
                  {/* Status de Aprovação do Admin */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={`text-[11px] tracking-wide block ${theme === "light" ? "text-[#8a8a93] font-medium" : "text-xs uppercase tracking-widest text-[#71717a] mono-text"}`}>Avaliação da rede</span>
                      <span className={`text-sm font-semibold inline-flex items-center gap-1 ${theme === "light" ? "text-[#111]" : "text-white mono-text"}`}>
                        <Icon name="star" size={16} filled className="text-amber-500" /> {makerProfile.rating} / 5.0
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-[11px] tracking-wide block ${theme === "light" ? "text-[#8a8a93] font-medium" : "text-xs uppercase tracking-widest text-[#71717a] mono-text"}`}>Status de cadastro</span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        makerProfile.isBanned ? "border-red-500/30 text-red-500 bg-red-500/5 animate-pulse" :
                        makerProfile.makerStatus === "HOMOLOGATED" ? "border-green-500/30 text-green-600 bg-green-500/5" :
                        makerProfile.makerStatus === "SANDBOX" ? "border-blue-500/30 text-blue-600 bg-blue-500/5" :
                        "border-yellow-500/30 text-yellow-600 bg-yellow-500/5"
                      }`}>
                        {makerProfile.isBanned ? "Banido" : 
                         makerProfile.makerStatus === "HOMOLOGATED" ? "Homologado" : 
                         makerProfile.makerStatus === "SANDBOX" ? "Sandbox" : 
                         "Aguardando auditoria"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ALERTA DE BANIDO POR PENALIDADES */}
                {makerProfile.isBanned ? (
                  <div className="border border-red-500/30 bg-red-950/20 p-8 rounded text-center space-y-4">
                    <div className="w-12 h-12 rounded bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
                      <Icon name="warning" size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-red-500 uppercase tracking-wider mono-text">Colaborador Suspenso e Banido</h3>
                      <p className="text-xs text-[#a1a1aa] mt-2 max-w-lg mx-auto leading-relaxed">
                        Sua conta foi suspensa temporariamente devido ao acúmulo excessivo de cancelamentos pós-aceite de trabalhos ou reputação abaixo da média mínima tolerada de <span className="text-white">4.0★</span>.
                      </p>
                    </div>
                    <button 
                      onClick={resetMakerTest} 
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded transition"
                    >
                      Restaurar Conta (Testes e Simulação)
                    </button>
                  </div>
                ) : makerProfile.makerStatus === "PENDING_APPROVAL" ? (
                  <div className="border border-yellow-500/30 bg-yellow-950/20 p-8 rounded text-center space-y-4">
                    <div className="w-12 h-12 rounded bg-yellow-500/10 text-yellow-500 flex items-center justify-center mx-auto border border-yellow-500/20 animate-pulse">
                      <Icon name="hourglass_empty" size={28} />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-yellow-500 uppercase tracking-wider mono-text">Cadastro em Auditoria de Segurança</h3>
                      <p className="text-xs text-[#a1a1aa] mt-2 max-w-lg mx-auto leading-relaxed">
                        Sua solicitação foi enviada para a fila de homologação. O administrador da plataforma auditará seus documentos KYC, selfie e a precisão dimensional do cubo de teste.
                      </p>
                      <div className="bg-[#050506] border border-[#18181b] p-4 rounded max-w-md mx-auto mt-4 text-left text-xs text-[#a1a1aa] space-y-1.5 mono-text">
                        <p className="font-bold text-white border-b border-[#18181b] pb-1 uppercase text-xs tracking-wider">Seus Dados de Calibração Física</p>
                        <p>Eixo X medido: <span className="text-white font-bold">{makerProfile.calibX?.toFixed(2)} mm</span></p>
                        <p>Eixo Y medido: <span className="text-white font-bold">{makerProfile.calibY?.toFixed(2)} mm</span></p>
                        <p>Eixo Z medido: <span className="text-white font-bold">{makerProfile.calibZ?.toFixed(2)} mm</span></p>
                        <p>Desvio Máximo: <span className="text-red-400 font-bold">
                          {Math.max(
                            Math.abs(20 - (makerProfile.calibX || 20)),
                            Math.abs(20 - (makerProfile.calibY || 20)),
                            Math.abs(20 - (makerProfile.calibZ || 20))
                          ).toFixed(3)} mm
                        </span></p>
                      </div>
                    </div>
                    <p className="text-xs text-[#71717a]">
                      Próximo passo: entre como <strong className="text-white">Admin</strong> e aprove a homologação — ou use o atalho de teste (só UI local) abaixo.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!makerProfile) return;
                        const name = makerProfile.name || currentUser?.name;
                        if (!name) {
                          alert("Sessão sem nome de maker. Faça login de novo.");
                          return;
                        }
                        // Atalho MVP: só estado local (POST /api/admin exige adminToken — D009)
                        setMakerProfile({
                          ...makerProfile,
                          name,
                          isApproved: true,
                          makerStatus: "SANDBOX",
                        });
                        alert("Homologação de teste (local): você entrou em Sandbox e já pode aceitar jobs.");
                      }}
                      className="px-4 py-2 bg-[#d44d00] hover:bg-[#b04000] text-white text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer"
                    >
                      Aprovar meu cadastro (teste)
                    </button>
                  </div>
                ) : (
                  // MAKER ATIVO (HOMOLOGADO OU SANDBOX)
                  <div className="space-y-6">
                    {(() => {
                      const completedCount = orders.filter(
                        (o) => o.makerName === makerProfile.name && o.status === "COMPLETED"
                      ).length;
                      return (
                    <>
                    {/* Faixa de Sandbox — mais calma */}
                    {makerProfile.makerStatus === "SANDBOX" && (
                      <div className={`px-4 py-3 rounded-xl text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border ${
                        theme === "light"
                          ? "border-blue-200 bg-blue-50/80"
                          : "border-blue-500/25 bg-blue-500/[0.07]"
                      }`}>
                        <div>
                          <strong className={`block text-[11px] tracking-wide ${theme === "light" ? "text-[#111] font-semibold" : "text-white uppercase tracking-wider"}`}>Sandbox — experiência</strong>
                          <span className={`mt-0.5 block ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#5c5c66]"}`}>
                            Até 1 job por vez · meta de 3 entregas para sair do período probatório
                          </span>
                        </div>
                        <div className={`px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                          theme === "light"
                            ? "bg-white border border-blue-200 text-blue-700"
                            : "bg-blue-500/15 border border-blue-500/25 mono-text text-white font-bold"
                        }`}>
                          {completedCount} / 3 entregas
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <h2 className={`text-sm font-bold uppercase tracking-wider mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>
                        Fila de trabalho
                      </h2>
                      <p className={`text-xs ${theme === "dark" ? "text-[#71717a]" : "text-[#52525b]"}`}>
                        Aceite um job → produza → marque despacho → confirme entrega e pagamento.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* RADAR */}
                    <div className="lg:col-span-8 space-y-5">
                      
                      {activeJobOffer ? (
                        <div className="border border-[#d44d00]/50 bg-[#d44d00]/[0.06] p-5 rounded-lg space-y-4 relative">
                          <div className="absolute top-0 left-0 w-full h-0.5 bg-[#d44d00]" />
                          
                          <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0">
                              <span className="text-[10px] uppercase tracking-widest text-[#d44d00] font-bold mono-text block">Oferta na fila</span>
                              <h3 className={`text-base font-bold mt-1 truncate ${theme === "dark" ? "text-white" : "text-black"}`}>{activeJobOffer.filename}</h3>
                              <p className={`text-xs mt-1 ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
                                {activeJobOffer.material} · {activeJobOffer.weightG}g · CEP {activeJobOffer.zipCode}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[9px] uppercase tracking-widest text-[#71717a] block mono-text">Aceitar em</span>
                              <span className={`text-2xl font-bold mono-text tabular-nums ${offerTimer <= 10 ? "text-red-500 animate-pulse" : "text-[#d44d00]"}`}>
                                {offerTimer}s
                              </span>
                            </div>
                          </div>

                          <div className={`grid grid-cols-3 gap-3 border-t pt-4 text-xs ${theme === "dark" ? "border-[#18181b]" : "border-[#e4e4e7]"}`}>
                            <div>
                              <span className="text-[10px] text-[#71717a] uppercase block">Tempo</span>
                              <span className={`font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>{activeJobOffer.timeFormatted}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#71717a] uppercase block">Seu ganho</span>
                              <span className="font-bold text-[#10b981]">R$ {(activeJobOffer.makerPayout || activeJobOffer.totalPrice * 0.95).toFixed(2).replace(".", ",")}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#71717a] uppercase block">Taxa</span>
                              <span className={`font-bold ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>R$ {(activeJobOffer.platformFee || activeJobOffer.totalPrice * 0.05).toFixed(2).replace(".", ",")}</span>
                            </div>
                          </div>

                          <div className="flex gap-3 pt-1">
                            <button
                              type="button"
                              onClick={acceptJob}
                              className="flex-1 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded-md transition cursor-pointer text-center"
                            >
                              Aceitar job
                            </button>
                            <button
                              type="button"
                              onClick={rejectJob}
                              className={`py-3 px-5 border text-xs font-semibold uppercase rounded-md transition cursor-pointer ${
                                theme === "dark"
                                  ? "border-[#27272a] text-[#a1a1aa] hover:text-white"
                                  : "border-[#d4d4d8] text-[#52525b] hover:text-black"
                              }`}
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={`rounded-lg overflow-hidden border ${theme === "dark" ? "border-[#18181b] bg-[#09090b]/60" : "border-[#e4e4e7] bg-white"}`}>
                          <div className={`px-5 py-3.5 border-b flex justify-between items-center ${theme === "dark" ? "border-[#18181b] bg-[#09090b]" : "border-[#e4e4e7] bg-[#fafafa]"}`}>
                            <h3 className={`text-xs font-bold uppercase tracking-wider mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>
                              Demandas disponíveis
                            </h3>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => refreshOrdersFromApi()}
                                className="text-[10px] uppercase tracking-wider font-bold text-[#d44d00] hover:opacity-80 transition cursor-pointer"
                              >
                                Atualizar
                              </button>
                              <span className="flex items-center gap-1.5 text-[10px] text-[#10b981] font-bold uppercase tracking-wider mono-text">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                                Online
                              </span>
                            </div>
                          </div>

                          <div className={`divide-y text-xs ${theme === "dark" ? "divide-[#18181b]" : "divide-[#e4e4e7]"}`}>
                            {orders.filter(o => o.status === "WAITING_MAKER").length === 0 ? (
                              <div className="p-10 text-center text-[#71717a] space-y-2">
                                <h4 className={`font-bold uppercase text-xs tracking-wider mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>
                                  Sem pedidos na fila
                                </h4>
                                <p className="text-xs max-w-xs mx-auto leading-relaxed">
                                  Quando houver seed ou cliente com STL, as ofertas aparecem aqui.
                                </p>
                              </div>
                            ) : (
                              orders.filter(o => o.status === "WAITING_MAKER").map((ord) => (
                                <div key={ord.id} className={`p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition ${
                                  theme === "dark" ? "hover:bg-white/[0.02]" : "hover:bg-[#f4f4f5]"
                                }`}>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`font-bold mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>{ord.filename}</span>
                                      <span className="text-[8px] bg-[#d44d00]/15 text-[#d44d00] border border-[#d44d00]/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mono-text">Fila</span>
                                      {ord.catalogId ? (
                                        <span className="text-[8px] bg-[#18181b]/5 text-[#52525b] border border-[#e4e4e7] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mono-text">
                                          Catálogo
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="text-xs text-[#71717a]">{ord.material} · {ord.weightG}g · CEP {ord.zipCode}</p>
                                    {getCuratedStlUrl(ord.catalogId) ? (
                                      <a
                                        href={getCuratedStlUrl(ord.catalogId)!}
                                        download={ord.filename}
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#d44d00] hover:underline mono-text"
                                      >
                                        Baixar STL
                                      </a>
                                    ) : null}
                                  </div>
                                  <div className="sm:text-right space-y-2 shrink-0">
                                    <div>
                                      <span className="text-[8px] text-[#71717a] block uppercase tracking-wider mono-text">Ganho</span>
                                      <span className="text-sm font-extrabold text-[#10b981] mono-text">R$ {(ord.makerPayout || ord.totalPrice * 0.95).toFixed(2).replace(".", ",")}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => void claimOrder(ord.id)}
                                      className="px-4 py-2 bg-[#d44d00] hover:bg-[#b04000] text-white text-xs font-bold uppercase tracking-wider rounded-md transition cursor-pointer"
                                    >
                                      Aceitar
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Em produção */}
                      <div className={`rounded-lg overflow-hidden border ${theme === "dark" ? "border-[#18181b] bg-[#09090b]/60" : "border-[#e4e4e7] bg-white"}`}>
                        <div className={`px-5 py-3.5 border-b flex justify-between items-center ${theme === "dark" ? "border-[#18181b] bg-[#09090b]" : "border-[#e4e4e7] bg-[#fafafa]"}`}>
                          <h3 className={`text-xs font-bold uppercase tracking-wider mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>
                            Em produção
                          </h3>
                          <span className="text-[10px] text-[#71717a] mono-text">imprimir → despachar → pagar</span>
                        </div>
                        <div className={`divide-y text-xs ${theme === "dark" ? "divide-[#18181b]" : "divide-[#e4e4e7]"}`}>
                          {orders.filter(o => o.makerName === makerProfile.name).length === 0 ? (
                            <div className="p-8 text-center text-[#71717a]">
                              Nenhum job alocado. Aceite um da fila acima.
                            </div>
                          ) : (
                          orders.filter(o => o.makerName === makerProfile.name).map((ord) => (
                            <div key={ord.id} className={`p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 ${
                              theme === "dark" ? "bg-[#09090b]/20" : "bg-[#fafafa]/80"
                            }`}>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-bold ${theme === "dark" ? "text-white" : "text-black"}`}>{ord.filename}</span>
                                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase mono-text ${
                                    ord.status === "PRINTING" ? "border-[#d44d00]/30 text-[#d44d00]" :
                                    ord.status === "SHIPPED" ? "border-blue-500/30 text-blue-400" :
                                    ord.status === "COMPLETED" ? "border-green-500/30 text-[#10b981]" :
                                    "border-zinc-700 text-[#a1a1aa]"
                                  }`}>
                                    {ord.status === "PRINTING" ? "Imprimindo" :
                                     ord.status === "SHIPPED" ? "Despachado" :
                                     ord.status === "COMPLETED" ? "Pago" : ord.status}
                                  </span>
                                </div>
                                <div className="text-xs text-[#71717a]">{ord.weightG}g · {ord.material}</div>
                                {ord.status === "PRINTING" && (
                                  <div className={`text-xs font-bold pt-1 ${theme === "dark" ? "text-white" : "text-black"}`}>Progresso: {ord.progress}%</div>
                                )}
                                {ord.status === "COMPLETED" && (
                                  <div className="text-xs text-[#10b981] font-bold pt-1">
                                    Liberado: R$ {(ord.makerPayout || ord.totalPrice * 0.95).toFixed(2).replace(".", ",")}
                                  </div>
                                )}
                              </div>
                              <div className="sm:text-right space-y-2 flex flex-col sm:items-end">
                                {ord.status === "PRINTING" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void advanceOrder(ord.id)}
                                      className="px-3 py-1.5 bg-[#d44d00] hover:bg-[#b04000] text-white text-xs font-bold uppercase tracking-wider rounded-md transition cursor-pointer"
                                    >
                                      Marcar despachado
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => cancelActiveJob(ord.id)}
                                      className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-wider border border-red-500/20 bg-red-500/5 px-2.5 py-1 rounded transition cursor-pointer"
                                    >
                                      Desistir (penalidade)
                                    </button>
                                  </>
                                )}
                                {ord.status === "SHIPPED" && (
                                  <button
                                    type="button"
                                    onClick={() => void advanceOrder(ord.id)}
                                    className="px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold uppercase tracking-wider rounded-md transition cursor-pointer"
                                  >
                                    Confirmar entrega / pagar
                                  </button>
                                )}
                                {ord.status === "COMPLETED" && (
                                  <span className="text-xs text-[#10b981] font-bold uppercase tracking-wider">Ciclo fechado</span>
                                )}
                              </div>
                            </div>
                          ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Especificações do Maker Cadastrado */}
                    <div className="lg:col-span-4 space-y-6">
                      <div className={`p-6 rounded-2xl space-y-4 border ${
                        theme === "light"
                          ? "bg-white border-[#ebebef] shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
                          : "technical-panel"
                      }`}>
                        <h3 className={`text-sm font-semibold tracking-tight ${theme === "light" ? "text-[#111]" : "text-xs font-bold text-white uppercase tracking-widest mono-text"}`}>
                          Especificações do maker
                        </h3>
                        
                        <div className={`p-3.5 rounded-xl space-y-2 border ${
                          theme === "light" ? "border-[#ebebef] bg-[#fafafa]" : "border-[#18181b] bg-[#050506]"
                        }`}>
                          <span className={`block ${theme === "light" ? "text-[12px] font-medium text-[#8a8a93]" : "text-[8px] uppercase tracking-wider text-[#71717a] mono-text"}`}>Impressoras cadastradas</span>
                          {makerProfile.machines.map(m => (
                            <div key={m.id} className={`text-sm font-medium flex justify-between ${theme === "light" ? "text-[#111]" : "text-xs font-bold text-white"}`}>
                              <span>{m.brand} {m.model}</span>
                              <span className={`font-normal ${theme === "light" ? "text-[#8a8a93]" : "text-[#a1a1aa]"}`}>{m.nozzle}</span>
                            </div>
                          ))}
                        </div>

                        <div className={`p-3.5 rounded-xl space-y-2 border ${
                          theme === "light" ? "border-[#ebebef] bg-[#fafafa]" : "border-[#18181b] bg-[#050506]"
                        }`}>
                          <span className={`block ${theme === "light" ? "text-[12px] font-medium text-[#8a8a93]" : "text-[8px] uppercase tracking-wider text-[#71717a] mono-text"}`}>Estoque de filamento</span>
                          {makerProfile.filaments.map(f => (
                            <div key={f.id} className={`text-sm font-medium flex justify-between ${theme === "light" ? "text-[#111]" : "text-xs font-bold text-white"}`}>
                              <span>{f.type} ({f.color})</span>
                              <span className={`font-normal ${theme === "light" ? "text-[#8a8a93]" : "text-[#a1a1aa]"}`}>{f.weightG}g</span>
                            </div>
                          ))}
                        </div>

                        <div className={`p-3.5 rounded-xl space-y-2 border ${
                          theme === "light" ? "border-[#ebebef] bg-[#fafafa]" : "border-[#18181b] bg-[#050506]"
                        }`}>
                          <span className={`block ${theme === "light" ? "text-[12px] font-medium text-[#8a8a93]" : "text-[8px] uppercase tracking-wider text-[#71717a] mono-text"}`}>Disponibilidade declarada</span>
                          <p className={`text-sm font-medium ${theme === "light" ? "text-[#111]" : "text-xs font-bold uppercase tracking-widest mono-text text-white"}`}>
                            Dias: {makerProfile.availability.days.join(", ")}
                          </p>
                          <p className={`text-xs mt-1 leading-normal ${theme === "light" ? "text-[#8a8a93]" : "text-[#71717a]"}`}>
                            Turnos: {makerProfile.availability.shifts.join(", ")}
                          </p>
                        </div>
                      </div>
                    </div>
                    </div>
                    </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      {/* TAB 3.5: PAINEL DO DESIGNER (LOGADO) */}
      {SHOW_LATER_UI && activeTab === "designer" && (
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
          <div className="border-b border-[#18181b] pb-4 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-tight mono-text">Espaço do Designer 3D</h2>
              <p className="text-xs text-[#a1a1aa] mt-1">Configure sua precificação de modelagem 3D sob encomenda e publique suas criações autorais.</p>
            </div>
            <div className="flex gap-2">
              <span className={`text-[10px] font-bold px-3 py-1 rounded border uppercase tracking-wider mono-text ${
                designerStatus === "NONE" ? "border-yellow-500/20 text-yellow-500 bg-yellow-500/5" :
                designerStatus === "PENDING_APPROVAL" ? "border-blue-500/20 text-blue-500 bg-blue-500/5 animate-pulse" :
                "border-green-500/20 text-green-500 bg-green-500/5"
              }`}>
                {designerStatus === "NONE" ? "Sem Perfil Ativo" :
                 designerStatus === "PENDING_APPROVAL" ? "Aguardando Aprovação" : "Perfil Aprovado"}
              </span>
            </div>
          </div>

          {/* SE DESIGNER NÃO POSSUI PERFIL SUBMETIDO */}
          {designerStatus === "NONE" && (
            <div className={`max-w-3xl mx-auto p-8 rounded-xl border space-y-6 ${
              theme === "dark" ? "border-[#18181b] bg-[#09090b]/40" : "border-[#e4e4e7] bg-white shadow-sm"
            }`}>
              <h3 className={`text-sm font-bold uppercase tracking-wider mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>Formulário de Entrada do Designer</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#71717a] uppercase tracking-wider mono-text">Disponibilidade Declarada</label>
                  <select 
                    value={designerAvailability} 
                    onChange={(e) => setDesignerAvailability(e.target.value)}
                    className="w-full bg-[#050506] border border-[#18181b] rounded-lg p-2.5 text-xs text-white focus:border-[#d44d00] focus:outline-none"
                  >
                    <option value="10h por semana (Part-time)">10h por semana (Part-time)</option>
                    <option value="20h por semana (Freelancer)">20h por semana (Freelancer)</option>
                    <option value="30h por semana (Disponível)">30h por semana (Disponível)</option>
                    <option value="40h por semana (Full-time)">40h por semana (Full-time)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#71717a] uppercase tracking-wider mono-text">Valor da Hora de Trabalho (R$)</label>
                  <input 
                    type="number" 
                    value={designerHourRate} 
                    onChange={(e) => setDesignerHourRate(Number(e.target.value))}
                    className="w-full bg-[#050506] border border-[#18181b] rounded-lg p-2.5 text-xs text-white focus:border-[#d44d00] focus:outline-none"
                    placeholder="Ex: 65"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#71717a] uppercase tracking-wider mono-text">Especialidades (O que você modela?)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {["Maquetes", "Bonecos / Personagens", "Peças Automotivas", "Decoração", "Organizadores", "Miniaturas"].map(spec => (
                    <label key={spec} className="flex items-center gap-2 text-xs text-[#a1a1aa] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={designerSpecialties.includes(spec)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDesignerSpecialties(prev => [...prev, spec]);
                          } else {
                            setDesignerSpecialties(prev => prev.filter(x => x !== spec));
                          }
                        }}
                        className="rounded border-[#18181b] bg-[#050506] text-[#d44d00] focus:ring-[#d44d00]"
                      />
                      <span>{spec}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#71717a] uppercase tracking-wider mono-text">Formação, Cursos & Links de Portfólio</label>
                <textarea 
                  value={designerPortfolio}
                  onChange={(e) => setDesignerPortfolio(e.target.value)}
                  placeholder="Descreva seu histórico acadêmico ou técnico, softwares que domina (SolidWorks, Blender, Fusion 360) e anexe links de seus trabalhos."
                  rows={4}
                  className="w-full bg-[#050506] border border-[#18181b] rounded-lg p-2.5 text-xs text-white focus:border-[#d44d00] focus:outline-none"
                />
              </div>

              {/* Termo Jurídico Obrigatório */}
              <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-lg space-y-3">
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mono-text">Termo de Compromisso Jurídico & Responsabilidade</h4>
                <p className="text-[10px] text-[#a1a1aa] leading-relaxed">
                  Declaro que sou integralmente responsável pela originalidade e propriedade intelectual de todas as obras autorais e criações sob encomenda enviadas à plataforma. Estou ciente de que o uso não autorizado de logotipos de marcas comerciais, marcas registradas, times de futebol, símbolos ou personagens sob patentes corporativas sem licenciamento explícito é de minha total responsabilidade civil e criminal, eximindo expressamente a FabMakers de quaisquer custas jurídicas ou cumplicidade legal.
                </p>
                <label className="flex items-start gap-2.5 text-[11px] text-white cursor-pointer select-none font-semibold">
                  <input 
                    type="checkbox" 
                    checked={designerLegalAccepted}
                    onChange={(e) => setDesignerLegalAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-[#18181b] bg-[#050506] text-[#d44d00]"
                  />
                  <span>Li e aceito os termos de responsabilidade intelectual e jurídica.</span>
                </label>
              </div>

              <button
                disabled={!designerLegalAccepted || !designerPortfolio}
                onClick={() => {
                  setDesignerStatus("PENDING_APPROVAL");
                  // Adiciona à lista de designers pendentes para moderação rápida
                  const newDes = {
                    id: `des_${Date.now()}`,
                    name: currentUser?.name || "Designer",
                    email: currentUser?.email || "designer@fabmakers.com.br",
                    availability: designerAvailability,
                    hourRate: designerHourRate,
                    specialties: designerSpecialties,
                    portfolio: designerPortfolio,
                    status: "PENDING_APPROVAL" as const
                  };
                  setPlataformaDesigners(prev => [...prev, newDes]);
                }}
                className={`w-full py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
                  designerLegalAccepted && designerPortfolio
                    ? "bg-[#d44d00] hover:bg-[#b04000] text-white shadow-md shadow-[#d44d00]/10 cursor-pointer"
                    : "bg-[#18181b] border border-[#27272a] text-[#71717a] cursor-not-allowed"
                }`}
              >
                Enviar Perfil para Moderação
              </button>
            </div>
          )}

          {/* STATUS: AGUARDANDO MODERAÇÃO */}
          {designerStatus === "PENDING_APPROVAL" && (
            <div className="max-w-2xl mx-auto p-12 text-center border border-dashed border-blue-500/30 bg-blue-500/5 rounded-xl space-y-4">
              <span className="block animate-pulse text-[#d44d00]">
                <Icon name="hourglass_empty" size={40} />
              </span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mono-text">Perfil em Análise Regulatória</h3>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Nossa equipe de moderadores está avaliando seu portfólio, cursos declarados e conformidade de propriedade intelectual. Você receberá uma notificação em até 24 horas. Para testes rápidos locais, você pode logar como Moderador para aprovar este cadastro!
              </p>
            </div>
          )}

          {/* STATUS: APROVADO - PAINEL ATIVO DE PROJETO E OBRAS */}
          {designerStatus === "APPROVED" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Esquerda: Informações e Nova Obra */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-[#09090b] border border-[#18181b] p-6 rounded-lg space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Cadastrar Obra Autoral para Venda</h3>
                  
                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[#71717a] font-bold uppercase">Título da Criação</label>
                      <input 
                        type="text" value={novaObraTitle} onChange={(e) => setNovaObraTitle(e.target.value)}
                        className="w-full bg-[#050506] border border-[#18181b] rounded-lg p-2 text-white focus:outline-none"
                        placeholder="Ex: Suporte de Headset Dragão"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[#71717a] font-bold uppercase">Categoria</label>
                        <select 
                          value={novaObraCategory} onChange={(e) => setNovaObraCategory(e.target.value)}
                          className="w-full bg-[#050506] border border-[#18181b] rounded-lg p-2 text-white focus:outline-none"
                        >
                          <option value="Peças Técnicas">Peças Técnicas</option>
                          <option value="Decoração">Decoração</option>
                          <option value="Organização">Organização</option>
                          <option value="Brinquedos / Geek">Brinquedos / Geek</option>
                          <option value="Miniaturas">Miniaturas</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[#71717a] font-bold uppercase">Preço dos Royalties (R$)</label>
                        <input 
                          type="number" value={novaObraPrice} onChange={(e) => setNovaObraPrice(Number(e.target.value))}
                          className="w-full bg-[#050506] border border-[#18181b] rounded-lg p-2 text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[#71717a] font-bold uppercase">URL da Imagem do Modelo</label>
                      <input 
                        type="text" value={novaObraImage} onChange={(e) => setNovaObraImage(e.target.value)}
                        className="w-full bg-[#050506] border border-[#18181b] rounded-lg p-2 text-white focus:outline-none"
                        placeholder="Ex: https://images.unsplash.com/... (ou deixe vazio para padrão)"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[#71717a] font-bold uppercase">Descrição da Peça</label>
                      <textarea 
                        value={novaObraDescription} onChange={(e) => setNovaObraDescription(e.target.value)}
                        className="w-full bg-[#050506] border border-[#18181b] rounded-lg p-2 text-white focus:outline-none"
                        placeholder="Descreva detalhes como espessura de parede recomendada, tipo de filamento ideal, etc."
                        rows={2}
                      />
                    </div>

                    <button
                      onClick={() => {
                        if (!novaObraTitle || !novaObraDescription) {
                          alert("Preencha o título e a descrição da sua obra!");
                          return;
                        }
                        const newObra = {
                          id: `obra_${Date.now()}`,
                          title: novaObraTitle,
                          category: novaObraCategory,
                          description: novaObraDescription,
                          price: novaObraPrice,
                          image: novaObraImage || "https://images.unsplash.com/photo-1608889175123-8ec330b86f84?w=300"
                        };
                        setDesignerObras(prev => [newObra, ...prev]);
                        setNovaObraTitle("");
                        setNovaObraDescription("");
                        setNovaObraImage("");
                        alert(`Obra Autoral "${novaObraTitle}" publicada com sucesso e enviada para o Marketplace!`);
                      }}
                      className="w-full py-2 bg-[#d44d00] hover:bg-[#b04000] text-white text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer"
                    >
                      Publicar Nova Obra
                    </button>
                  </div>
                </div>
              </div>

              {/* Direita: Obras já publicadas */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-[#09090b] border border-[#18181b] p-6 rounded-lg space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Minhas Criações Ativas</h3>
                  
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                    {designerObras.map(o => (
                      <div key={o.id} className="p-3 border border-[#18181b] rounded flex justify-between items-center bg-[#050506]">
                        <div>
                          <p className="text-xs font-bold text-white">{o.title}</p>
                          <span className="text-[9px] text-[#71717a] uppercase tracking-wider mono-text">{o.category} | Royalties: R$ {o.price.toFixed(2)}</span>
                        </div>
                        <button
                          onClick={() => {
                            setDesignerObras(prev => prev.filter(x => x.id !== o.id));
                          }}
                          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-[9px] font-bold uppercase transition"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* TAB 3.7: PAINEL DO MODERADOR */}
      {SHOW_LATER_UI && activeTab === "moderator" && (
        <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
          <div className="border-b border-[#18181b] pb-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight mono-text">Espaço de Moderação & Governança</h2>
            <p className="text-xs text-[#a1a1aa] mt-1">Homologue designers pendentes e revise arquivos com alegações de direitos autorais ou patentes.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Esquerda: Aprovação de Designers */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-[#09090b] border border-[#18181b] p-6 rounded-lg space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Homologação de Designers Pendentes ({plataformaDesigners.filter(d => d.status === "PENDING_APPROVAL").length})</h3>
                
                <div className="space-y-4">
                  {plataformaDesigners.filter(d => d.status === "PENDING_APPROVAL").length === 0 ? (
                    <p className="text-xs text-[#71717a] text-center py-4">Nenhum designer pendente de aprovação.</p>
                  ) : (
                    plataformaDesigners.filter(d => d.status === "PENDING_APPROVAL").map(d => (
                      <div key={d.id} className="p-4 border border-[#18181b] rounded-lg bg-[#050506] space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white">{d.name} ({d.email})</span>
                          <span className="text-xs text-[#d44d00] font-bold">R$ {d.hourRate.toFixed(2)}/h</span>
                        </div>
                        <p className="text-xs text-[#a1a1aa] leading-relaxed">{d.portfolio}</p>
                        
                        <div className="flex justify-end gap-2 pt-2 border-t border-[#18181b]/50">
                          <button
                            onClick={() => {
                              // Reprova designer (muda status para NONE localmente no cadastro)
                              setPlataformaDesigners(prev => prev.map(x => x.id === d.id ? { ...x, status: "APPROVED" as const } : x));
                              setDesignerStatus("APPROVED"); // Para simular aprovação imediata do designer logado se for ele
                              alert(`Designer "${d.name}" aprovado com sucesso e ativo na plataforma!`);
                            }}
                            className="px-3 py-1.5 bg-[#10b981] hover:bg-emerald-600 text-white text-[10px] font-bold rounded uppercase tracking-wider transition cursor-pointer"
                          >
                            Aprovar
                          </button>
                          <button
                            onClick={() => {
                              setPlataformaDesigners(prev => prev.filter(x => x.id !== d.id));
                              alert(`Cadastro de "${d.name}" recusado para ajustes de termos.`);
                            }}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded uppercase tracking-wider transition cursor-pointer"
                          >
                            Recusar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Direita: Moderação Jurídica de Obras da Galeria (Direitos de marcas e times) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-[#09090b] border border-[#18181b] p-6 rounded-lg space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Controle Jurídico de Patentes & Marcas</h3>
                <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                  Avalie denúncias de peças contendo times de futebol (Corinthians, Flamengo), marcas registradas (Nike, Apple) ou marcas automotivas e remova da plataforma.
                </p>

                <div className="space-y-3">
                  <div className="p-3 border border-[#18181b] rounded bg-red-500/5 text-xs space-y-2">
                    <div className="flex justify-between items-center text-red-400 font-bold">
                      <span className="inline-flex items-center gap-1">
                        <Icon name="warning" size={14} /> DENÚNCIA ATIVA
                      </span>
                      <span>Chaveiro Brasil Copa</span>
                    </div>
                    <p className="text-[10px] text-[#71717a]">Denunciante: Agência de Propriedade Intelectual (Marca de Símbolos Oficiais).</p>
                    <button
                      onClick={() => {
                        // Remove da galeria de obras autorais simulação
                        setDesignerObras(prev => prev.filter(x => x.title !== "Chaveiro Suporte de Celular do Brasil Copa"));
                        alert("Obras contendo símbolos patentários removidas de circulação por segurança jurídica.");
                      }}
                      className="w-full py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-[10px] uppercase rounded transition"
                    >
                      Remover Peça da Galeria
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

        {/* TAB 4: PAINEL ADMINISTRATIVO — exige role ADMIN */}
        {activeTab === "admin" && currentUser?.role !== "ADMIN" && (
          <div className="max-w-lg mx-auto px-6 py-20 text-center space-y-5">
            <div className={`rounded-2xl border p-8 space-y-4 ${
              theme === "dark" ? "border-[#18181b] bg-[#09090b]/40" : "border-[#ebebef] bg-white"
            }`}>
              <Icon name="admin_panel_settings" size={36} className="text-[#d44d00] mx-auto" />
              <h2 className={`text-xl font-bold tracking-tight ${theme === "dark" ? "text-white" : "text-[#111]"}`}>
                Acesso restrito
              </h2>
              <p className={`text-sm ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#5c5c66]"}`}>
                O painel de orquestração é só para administradores da rede.
                {currentUser
                  ? ` Sua sessão atual (${currentUser.role}) não tem permissão.`
                  : " Entre com uma conta admin para continuar."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                {!currentUser || currentUser.role !== "ADMIN" ? (
                  <button
                    type="button"
                    onClick={openAdminLogin}
                    className="px-6 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white text-xs font-bold uppercase tracking-wider rounded-full transition cursor-pointer"
                  >
                    Entrar como admin
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => goTo("home", "maker")}
                  className={`px-6 py-3 text-xs font-bold uppercase tracking-wider rounded-full border transition cursor-pointer ${
                    theme === "dark"
                      ? "border-white/15 text-white hover:bg-white/5"
                      : "border-black/10 text-[#111] hover:bg-black/5"
                  }`}
                >
                  Voltar ao início
                </button>
              </div>
              <p className="text-[10px] text-[#71717a] mono-text pt-2">MVP: admin@fabmakers.com.br / admin123</p>
            </div>
          </div>
        )}

        {activeTab === "admin" && currentUser?.role === "ADMIN" && (
          <div className="admin-shell max-w-7xl mx-auto px-6 py-12 space-y-10">
            
            <div className={`border-b pb-4 ${theme === "dark" ? "border-[#18181b]" : "border-[#e4e4e7]"}`}>
              <h2 className={`text-xl font-bold tracking-tight ${theme === "dark" ? "text-white uppercase mono-text" : "text-[#111]"}`}>
                Painel de orquestração
              </h2>
              <p className={`text-xs mt-1 ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#5c5c66]"}`}>
                Homologações, funil H5 e controle da rede de fabs.
              </p>
            </div>

            {/* Métricas de Escala */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`rounded-lg border p-5 ${theme === "dark" ? "technical-panel" : "bg-white border-[#ebebef]"}`}>
                <span className="text-xs uppercase tracking-wider text-[#71717a] mono-text block">Faturamento Bruto</span>
                <span className={`text-2xl font-bold block mt-1 mono-text ${theme === "dark" ? "text-white" : "text-[#111]"}`}>R$ {orders.filter(o => o.status !== "CANCELLED").reduce((acc, curr) => acc + curr.totalPrice, 0).toFixed(2).replace(".", ",")}</span>
              </div>
              <div className={`rounded-lg border p-5 ${theme === "dark" ? "technical-panel" : "bg-white border-[#ebebef]"}`}>
                <span className="text-xs uppercase tracking-wider text-[#71717a] mono-text block">Comissão Plataforma</span>
                <span className="text-2xl font-bold text-[#d44d00] block mt-1 mono-text">R$ {orders.filter(o => o.status !== "CANCELLED").reduce((acc, curr) => acc + (curr.platformFee || curr.totalPrice * 0.05), 0).toFixed(2).replace(".", ",")}</span>
              </div>
              <div className={`rounded-lg border p-5 ${theme === "dark" ? "technical-panel" : "bg-white border-[#ebebef]"}`}>
                <span className="text-xs uppercase tracking-wider text-[#71717a] mono-text block">Makers Ativos no Grid</span>
                <span className={`text-2xl font-bold block mt-1 mono-text ${theme === "dark" ? "text-white" : "text-[#111]"}`}>{systemMakers.filter(m => m.isApproved && !m.isBanned).length}</span>
              </div>
              <div className={`rounded-lg border p-5 ${theme === "dark" ? "technical-panel" : "bg-white border-[#ebebef]"}`}>
                <span className="text-xs uppercase tracking-wider text-[#71717a] mono-text block">Material Extrudado</span>
                <span className="text-2xl font-bold text-[#10b981] block mt-1 mono-text">{orders.filter(o => o.status === "COMPLETED").reduce((acc, curr) => acc + curr.weightG, 0).toFixed(1)}g</span>
              </div>
            </div>

            {/* Funil H5 — cadastro → homologado */}
            <div className={`rounded-lg border p-5 space-y-4 ${
              theme === "dark" ? "border-[#18181b] bg-[#09090b]/40" : "border-[#e4e4e7] bg-white"
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className={`text-xs font-bold uppercase tracking-wider mono-text ${theme === "dark" ? "text-white" : "text-black"}`}>
                    Funil H5 — cadastro → homologado
                  </h3>
                  <p className={`text-xs mt-1 ${theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
                    Aposta: onboarding pesado aumenta confiança mais do que reduz conversão.
                  </p>
                </div>
                {h5Funnel && (
                  <span className="text-xs font-bold text-[#d44d00] mono-text">
                    Conversão {h5Funnel.conversionPct}%
                  </span>
                )}
              </div>
              {h5Funnel ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                  {[
                    { label: "Início", value: h5Funnel.started },
                    { label: "Unverified", value: h5Funnel.counts.UNVERIFIED ?? 0 },
                    { label: "Pendente", value: h5Funnel.counts.PENDING_APPROVAL ?? 0 },
                    { label: "Sandbox", value: h5Funnel.counts.SANDBOX ?? 0 },
                    { label: "Homologado", value: h5Funnel.homologated },
                    { label: "Banidos", value: h5Funnel.counts.BANNED ?? 0 },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className={`rounded-lg border p-3 ${
                        theme === "dark" ? "border-[#18181b] bg-[#050506]" : "border-[#e4e4e7] bg-[#fafafa]"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider text-[#71717a] mono-text block">{s.label}</span>
                      <span className={`text-xl font-bold mono-text mt-1 block ${theme === "dark" ? "text-white" : "text-black"}`}>
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#71717a] mono-text">Carregando funil…</p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Lado Esquerdo: Fila de Homologação de Makers Pendentes */}
              <div className="lg:col-span-6 space-y-6">
                <div className={`rounded-lg overflow-hidden border ${theme === "dark" ? "technical-panel border-[#18181b]" : "bg-white border-[#ebebef]"}`}>
                  <div className={`px-6 py-4 border-b flex justify-between items-center ${theme === "dark" ? "border-[#18181b] bg-[#09090b]" : "border-[#ebebef] bg-[#fafafa]"}`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider mono-text ${theme === "dark" ? "text-white" : "text-[#111]"}`}>Homologações pendentes</h3>
                    <span className="text-[8px] bg-[#d44d00]/15 text-[#d44d00] px-2 py-0.5 rounded font-bold tracking-widest">BENCHMARK 3D</span>
                  </div>

                  <div className={`divide-y text-xs ${theme === "dark" ? "divide-[#18181b]" : "divide-[#ebebef]"}`}>
                    {homologations.map((req) => (
                      <div key={req.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className={`font-bold block ${theme === "dark" ? "text-white" : "text-[#111]"}`}>{req.name}</span>
                            <span className="text-xs text-[#71717a] mono-text">CEP: {req.zipCode} | Impressora: {req.machineModel}</span>
                          </div>
                          
                          <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase mono-text ${
                            req.benchmarkResult === "APPROVED" ? "border-green-500/30 text-green-500 bg-green-500/5" : "border-yellow-500/30 text-yellow-500 bg-yellow-500/5"
                          }`}>
                            {req.benchmarkResult === "APPROVED" ? "Homologado" : "Pendente"}
                          </span>
                        </div>

                        {req.benchmarkResult === "PENDING" && (() => {
                          const devX = Math.abs(20 - req.calibX);
                          const devY = Math.abs(20 - req.calibY);
                          const devZ = Math.abs(20 - req.calibZ);
                          const maxDeviation = Math.max(devX, devY, devZ);
                          const isWithinTolerance = maxDeviation <= 0.05;
                          const nest = theme === "dark" ? "bg-[#050506] border-[#18181b]" : "bg-[#fafafa] border-[#e4e4e7]";
                          const cell = theme === "dark" ? "bg-[#09090b] border-[#18181b]" : "bg-white border-[#e4e4e7]";
                          const ink = theme === "dark" ? "text-white" : "text-[#111]";
                          const muted = theme === "dark" ? "text-[#a1a1aa]" : "text-[#52525b]";

                          return (
                            <div className={`space-y-4 pt-2 border-t ${theme === "dark" ? "border-[#18181b]" : "border-[#ebebef]"}`}>
                              {/* Dados Dimensionais */}
                              <div className={`p-4 rounded border space-y-3 ${nest}`}>
                                <span className="text-xs text-[#71717a] font-bold uppercase tracking-wider block mono-text">
                                  1. Calibração dimensional (cubo 20mm)
                                </span>
                                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                  <div className={`border p-2 rounded ${cell}`}>
                                    <span className="text-[#71717a] block">Eixo X</span>
                                    <strong className={`${ink} block mt-0.5`}>{req.calibX.toFixed(2)} mm</strong>
                                    <span className={`text-[8px] block mt-0.5 ${devX <= 0.05 ? "text-green-500" : "text-red-500"}`}>
                                      Δ: {req.calibX - 20 >= 0 ? `+${(req.calibX - 20).toFixed(2)}` : (req.calibX - 20).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className={`border p-2 rounded ${cell}`}>
                                    <span className="text-[#71717a] block">Eixo Y</span>
                                    <strong className={`${ink} block mt-0.5`}>{req.calibY.toFixed(2)} mm</strong>
                                    <span className={`text-[8px] block mt-0.5 ${devY <= 0.05 ? "text-green-500" : "text-red-500"}`}>
                                      Δ: {req.calibY - 20 >= 0 ? `+${(req.calibY - 20).toFixed(2)}` : (req.calibY - 20).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className={`border p-2 rounded ${cell}`}>
                                    <span className="text-[#71717a] block">Eixo Z</span>
                                    <strong className={`${ink} block mt-0.5`}>{req.calibZ.toFixed(2)} mm</strong>
                                    <span className={`text-[8px] block mt-0.5 ${devZ <= 0.05 ? "text-green-500" : "text-red-500"}`}>
                                      Δ: {req.calibZ - 20 >= 0 ? `+${(req.calibZ - 20).toFixed(2)}` : (req.calibZ - 20).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                                <div className={`flex justify-between items-center text-xs border-t pt-2 ${theme === "dark" ? "border-[#18181b]/50" : "border-[#ebebef]"}`}>
                                  <span className="text-[#71717a]">Desvio máximo:</span>
                                  <span className={`font-bold ${isWithinTolerance ? "text-green-500" : "text-red-500"}`}>
                                    {maxDeviation.toFixed(3)} mm ({isWithinTolerance ? "Dentro ±0.05mm" : "Fora da tolerância"})
                                  </span>
                                </div>
                              </div>

                              {/* Documentos Anexados */}
                              <div className={`p-4 rounded border space-y-3 text-xs ${nest}`}>
                                <span className="text-xs text-[#71717a] font-bold uppercase tracking-wider block mono-text">
                                  2. Documentos KYC
                                </span>
                                <div className="grid grid-cols-3 gap-2">
                                  <a 
                                    href="#" 
                                    onClick={(e) => { e.preventDefault(); alert(`Visualizando documento simulado: ${req.documentUrl}`); }}
                                    className={`border p-2 rounded text-center block transition ${cell} ${muted} hover:border-[#d44d00]/40`}
                                  >
                                    <Icon name="badge" className="text-[18px] mb-0.5" />
                                    <span className="block text-[10px] font-semibold">RG/CNH</span>
                                    <span className="text-[8px] text-[#71717a] block truncate mt-0.5">{req.documentUrl}</span>
                                  </a>
                                  <a 
                                    href="#" 
                                    onClick={(e) => { e.preventDefault(); alert(`Visualizando selfie simulada: ${req.selfieUrl}`); }}
                                    className={`border p-2 rounded text-center block transition ${cell} ${muted} hover:border-[#d44d00]/40`}
                                  >
                                    <Icon name="photo_camera" className="text-[18px] mb-0.5" />
                                    <span className="block text-[10px] font-semibold">Selfie KYC</span>
                                    <span className="text-[8px] text-[#71717a] block truncate mt-0.5">{req.selfieUrl}</span>
                                  </a>
                                  <a 
                                    href="#" 
                                    onClick={(e) => { e.preventDefault(); alert(`Visualizando foto do paquímetro simulada: ${req.benchmarkImageUrl}`); }}
                                    className={`border p-2 rounded text-center block transition ${cell} ${muted} hover:border-[#d44d00]/40`}
                                  >
                                    <Icon name="straighten" className="text-[18px] mb-0.5" />
                                    <span className="block text-[10px] font-semibold">Paquímetro</span>
                                    <span className="text-[8px] text-[#71717a] block truncate mt-0.5">{req.benchmarkImageUrl}</span>
                                  </a>
                                </div>
                              </div>

                              {/* Diagnóstico de Fraude por IA (Onboarding KYC) */}
                              <div className={`p-4 rounded border space-y-3 text-xs ${nest}`}>
                                <span className="text-xs text-[#10b981] font-bold uppercase tracking-wider block mono-text">
                                  3. Diagnóstico KYC
                                </span>
                                <div className="space-y-2">
                                  <div className={`flex justify-between items-center border p-2 rounded ${cell}`}>
                                    <span className="text-[#71717a]">Biometria facial</span>
                                    <span className="text-green-600 font-bold inline-flex items-center gap-1"><Icon name="check_circle" size={14} /> 99.1%</span>
                                  </div>
                                  <div className={`flex justify-between items-center border p-2 rounded ${cell}`}>
                                    <span className="text-[#71717a]">Liveness selfie</span>
                                    <span className="text-green-600 font-bold inline-flex items-center gap-1"><Icon name="check_circle" size={14} /> OK</span>
                                  </div>
                                  <div className={`flex justify-between items-center border p-2 rounded ${cell}`}>
                                    <span className="text-[#71717a]">Documento OCR</span>
                                    <span className="text-green-600 font-bold inline-flex items-center gap-1"><Icon name="check_circle" size={14} /> CPF válido</span>
                                  </div>
                                </div>
                              </div>

                              {/* Ações de Auditoria */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => approveMakerRequest(req.id, req.name)}
                                  className="flex-grow py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-full uppercase tracking-wider transition cursor-pointer inline-flex items-center justify-center gap-1"
                                >
                                  <Icon name="verified" size={16} /> Aprovar
                                </button>
                                <button
                                  onClick={() => rejectMakerRequest(req.id, req.name)}
                                  className="px-4 py-2 border border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10 text-xs font-bold rounded-full uppercase tracking-wider transition cursor-pointer"
                                >
                                  Rejeitar
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lado Direito: Controle de Makers e Auditoria Geral */}
              <div className="lg:col-span-6 space-y-6">
                <div className={`rounded-lg overflow-hidden border ${theme === "dark" ? "technical-panel border-[#18181b]" : "bg-white border-[#ebebef]"}`}>
                  <div className={`px-6 py-4 border-b ${theme === "dark" ? "border-[#18181b] bg-[#09090b]" : "border-[#ebebef] bg-[#fafafa]"}`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider mono-text ${theme === "dark" ? "text-white" : "text-[#111]"}`}>Controle da rede</h3>
                  </div>

                  <div className={`divide-y text-xs ${theme === "dark" ? "divide-[#18181b]" : "divide-[#ebebef]"}`}>
                    {systemMakers.map((maker) => (
                      <div key={maker.id || `${maker.name}-${maker.zipCode}`} className="p-4 flex justify-between items-center">
                        <div>
                          <span className={`font-bold block ${theme === "dark" ? "text-white" : "text-[#111]"}`}>{maker.name}</span>
                          <span className="text-xs text-[#71717a] mono-text inline-flex items-center gap-1">
                            Reputação: <Icon name="star" size={12} filled /> {maker.rating} | Penalidades: {maker.penalties}/3
                          </span>
                        </div>
                        <button
                          onClick={() => toggleBanMaker(maker.name)}
                          className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider border transition ${
                            maker.isBanned
                              ? "border-green-500/30 text-green-600 bg-green-500/5 hover:bg-green-500/10"
                              : "border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10"
                          }`}
                        >
                          {maker.isBanned ? "Desbanir" : "Banir"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Dropshipping — Park/Cut (SHOW_LATER_UI); não polir no Core */}
            {SHOW_LATER_UI && (
            <div className="technical-panel rounded overflow-hidden">
              <div className="px-6 py-4 border-b border-[#18181b] bg-[#09090b] flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text">Gerenciamento da Loja de Insumos (Dropshipping)</h3>
                <span className="text-[8px] bg-[#d44d00]/15 text-[#d44d00] px-2 py-0.5 rounded font-bold tracking-widest">EXCLUSIVO ADMIN</span>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Formulário de Cadastro de Novo Produto */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!novoInsumoTitle || !novoInsumoPrice || !novoInsumoLink) {
                      alert("Preencha título, preço e link do produto!");
                      return;
                    }
                    const nov = {
                      id: `ins_${Date.now()}`,
                      title: novoInsumoTitle,
                      price: parseFloat(novoInsumoPrice),
                      link: novoInsumoLink,
                      affiliateCommissionPercent: parseInt(novoInsumoCommission) || 5,
                      image: novoInsumoImage || "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?w=300&auto=format&fit=crop&q=60",
                      deliveryTime: novoInsumoDelivery || "3 a 7 dias úteis",
                      platform: novoInsumoPlatform
                    };
                    setLojaInsumos(prev => [...prev, nov]);
                    setNovoInsumoTitle("");
                    setNovoInsumoPrice("");
                    setNovoInsumoLink("");
                    setNovoInsumoCommission("");
                    setNovoInsumoImage("");
                    setNovoInsumoDelivery("");
                    alert(`Produto "${nov.title}" cadastrado com sucesso na loja!`);
                  }}
                  className="space-y-4 border border-[#18181b] p-4 rounded bg-[#050506]"
                >
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mono-text">Cadastrar Novo Produto para Revenda / Dropshipping</h4>
                  
                  {/* Seção de Captura Automática */}
                  <div className="p-3 bg-[#09090b] border border-[#18181b] rounded space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#d44d00] mono-text">Importador Expresso por Link (Shopee / Amazon / AliExpress)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={linkImportacao} 
                        onChange={(e) => setLinkImportacao(e.target.value)} 
                        placeholder="Cole a URL do produto aqui (ex: https://shopee.com.br/filamento-pla...)"
                        className="flex-grow text-xs bg-[#050506] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00]"
                      />
                      <button
                        type="button"
                        disabled={importandoLink}
                        onClick={() => {
                          if (!linkImportacao) {
                            alert("Insira um link do produto primeiro!");
                            return;
                          }
                          setImportandoLink(true);
                          setTimeout(() => {
                            setImportandoLink(false);
                            let title = "Produto Importado 3D";
                            let price = "89.90";
                            let image = "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?w=300&auto=format&fit=crop&q=60";
                            let platform: "SHOPEE" | "TIKTOK" | "AMAZON" | "ALIEXPRESS" = "SHOPEE";

                            if (linkImportacao.includes("shopee")) {
                              title = "Filamento PETG Premium 1kg - GTMax3D (Shopee)";
                              price = "124.90";
                              image = "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?w=300&auto=format&fit=crop&q=60";
                              platform = "SHOPEE";
                            } else if (linkImportacao.includes("amazon")) {
                              title = "Impressora 3D Ender 3 V3 KE - Creality (Amazon)";
                              price = "2399.00";
                              image = "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&auto=format&fit=crop&q=60";
                              platform = "AMAZON";
                            } else if (linkImportacao.includes("aliexpress")) {
                              title = "Kit 5 Bicos Extrusores Volcano Aço Endurecido (AliExpress)";
                              price = "45.00";
                              image = "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=60";
                              platform = "ALIEXPRESS";
                            }

                            setNovoInsumoTitle(title);
                            setNovoInsumoPrice(price);
                            setNovoInsumoLink(linkImportacao);
                            setNovoInsumoImage(image);
                            setNovoInsumoPlatform(platform);
                            setNovoInsumoDelivery(platform === "ALIEXPRESS" ? "12 a 20 dias úteis" : "3 a 7 dias úteis");
                            setNovoInsumoCommission("8");
                            alert(`Sucesso! Captamos as informações do produto via link da plataforma de forma automatizada.`);
                          }, 1200);
                        }}
                        className="px-4 py-2 bg-[#18181b] hover:bg-[#27272a] text-white border border-[#27272a] text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer"
                      >
                        {importandoLink ? "Capturando..." : "Auto-Importar"}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-[#71717a] mono-text">Nome do Produto</label>
                      <input 
                        type="text" value={novoInsumoTitle} onChange={(e) => setNovoInsumoTitle(e.target.value)} placeholder="Filamento PLA 1kg"
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-[#71717a] mono-text">Preço de Venda (R$)</label>
                      <input 
                        type="number" step="0.01" value={novoInsumoPrice} onChange={(e) => setNovoInsumoPrice(e.target.value)} placeholder="119.90"
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-[#71717a] mono-text">Link do Fornecedor (Shopee/Ali)</label>
                      <input 
                        type="text" value={novoInsumoLink} onChange={(e) => setNovoInsumoLink(e.target.value)} placeholder="https://shopee..."
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-[#71717a] mono-text">Comissão de Afiliado (%)</label>
                      <input 
                        type="number" value={novoInsumoCommission} onChange={(e) => setNovoInsumoCommission(e.target.value)} placeholder="5"
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-[#71717a] mono-text">URL da Imagem</label>
                      <input 
                        type="text" value={novoInsumoImage} onChange={(e) => setNovoInsumoImage(e.target.value)} placeholder="https://images.unsplash..."
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-[#71717a] mono-text">Prazo de Entrega Estimado</label>
                      <input 
                        type="text" value={novoInsumoDelivery} onChange={(e) => setNovoInsumoDelivery(e.target.value)} placeholder="3 a 7 dias úteis"
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wider text-[#71717a] mono-text">Plataforma Dropshipping</label>
                      <select 
                        value={novoInsumoPlatform} 
                        onChange={(e) => setNovoInsumoPlatform(e.target.value as any)}
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      >
                        <option value="SHOPEE">Shopee Affiliate</option>
                        <option value="TIKTOK">TikTok Shop Partner</option>
                        <option value="AMAZON">Amazon Associate</option>
                        <option value="ALIEXPRESS">AliExpress Partner</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-2 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                  >
                    Adicionar Produto ao Dropshipping
                  </button>
                </form>

                {/* Lista de Produtos Cadastrados */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mono-text">Produtos Ativos na Loja</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    {lojaInsumos.map(prod => (
                      <div key={prod.id} className="border border-[#18181b] p-3 rounded bg-[#09090b] flex justify-between items-center">
                        <div>
                          <strong className="text-white block truncate max-w-[150px]">{prod.title}</strong>
                          <span className="text-xs text-[#71717a] mono-text">R$ {prod.price.toFixed(2)} | Prazo: {prod.deliveryTime}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setLojaInsumos(prev => prev.filter(p => p.id !== prod.id));
                            alert(`Produto "${prod.title}" removido da loja.`);
                          }}
                          className="text-xs text-red-500 hover:text-red-400 font-bold uppercase cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            )}

          </div>
        )}

      </main>

      {/* FOOTER TÉCNICO - Minimalista */}
      <footer className={`border-t py-12 transition-colors ${
        theme === "light" ? "border-[#ebebef] bg-white" : "border-[#18181b] bg-[#050506]"
      }`}>
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center">
              <Image 
                src={logoMark} 
                alt="FAB MAKERS" 
                className={`h-12 w-auto select-none bg-transparent ${theme === "light" ? "invert" : ""}`}
              />
            </div>
            <p className={`text-xs leading-relaxed ${theme === "light" ? "text-[#6b6b73]" : "text-[#71717a]"}`}>
              Manufatura digital distribuída sob demanda no Brasil. A maior infraestrutura descentralizada de ativos de impressão.
            </p>
          </div>
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider mono-text mb-3 ${theme === "light" ? "text-[#111]" : "text-white"}`}>Plataforma</h4>
            <ul className={`space-y-2 text-xs ${theme === "light" ? "text-[#6b6b73]" : "text-[#71717a]"}`}>
              <li><button onClick={() => { if (currentUser?.role === "MAKER") goTo("maker"); else { setLoginRole("MAKER"); setLoginEmail(""); setLoginPassword(""); setLoginError(""); setShowLoginModal(true); } }} className={`transition cursor-pointer ${theme === "light" ? "hover:text-[#111]" : "hover:text-white"}`}>Portal da Fab</button></li>
              <li><button onClick={() => { if (currentUser?.role === "CLIENT") goTo("client"); else { setLoginRole("CLIENT"); setLoginEmail(""); setLoginPassword(""); setLoginError(""); setShowLoginModal(true); } }} className={`transition cursor-pointer ${theme === "light" ? "hover:text-[#111]" : "hover:text-white"}`}>Seed demanda (STL)</button></li>
              <li><button onClick={() => { if (currentUser?.role === "ADMIN") goTo("admin"); else { setLoginRole("ADMIN"); setLoginEmail(""); setLoginPassword(""); setLoginError(""); setShowLoginModal(true); } }} className={`transition cursor-pointer ${theme === "light" ? "hover:text-[#111]" : "hover:text-white"}`}>Administração</button></li>
            </ul>
          </div>
          <div>
            <h4 className={`text-xs font-bold uppercase tracking-wider mono-text mb-3 ${theme === "light" ? "text-[#111]" : "text-white"}`}>Políticas da Rede</h4>
            <ul className={`space-y-2 text-xs ${theme === "light" ? "text-[#6b6b73]" : "text-[#71717a]"}`}>
              <li>SLA de Resposta: Aceite em 30s</li>
              <li>Desistência: Penalidade de Nível</li>
              <li>Tolerância Dimensional: ±0.05mm</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider mono-text mb-3 ${theme === "light" ? "text-[#111]" : "text-white"}`}>Status do Grid</h4>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/20 rounded-full text-xs font-semibold tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              Grid operacional: {systemMakers.filter(m => m.isApproved && !m.isBanned).length + 343} online
            </div>
            <p className={`text-xs mt-2 block ${theme === "light" ? "text-[#8a8a93]" : "text-[#71717a]"}`}>Latência média do roteador: 85ms</p>
          </div>
        </div>
        <div className={`max-w-7xl mx-auto px-6 mt-12 pt-6 border-t flex flex-col sm:flex-row justify-between text-xs gap-4 ${
          theme === "light" ? "border-[#ebebef] text-[#8a8a93]" : "border-[#18181b] text-[#71717a]"
        }`}>
          <p>&copy; {new Date().getFullYear()} FAB MAKERS. Todos os direitos reservados. Projeto Conceitual e Confidencial.</p>
        </div>
      </footer>

      {/* MODAL DE LOGIN MODULAR E SEGURO */}
      {showLoginModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4 ${
          theme === "dark" ? "bg-[#050506]/85" : "bg-[#111]/40"
        }`}>
          <div className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border ${
            theme === "dark" ? "bg-[#09090b] border-[#18181b]" : "bg-white border-[#ebebef]"
          }`}>
            {/* Header do Modal */}
            <div className={`px-6 py-4 border-b flex justify-between items-center ${
              theme === "dark" ? "border-[#18181b]" : "border-[#ebebef]"
            }`}>
              <h3 className={`text-xs font-bold uppercase tracking-wider mono-text ${
                theme === "dark" ? "text-white" : "text-[#111]"
              }`}>
                {isSignUp 
                  ? `Cadastrar ${loginRole === "MAKER" ? "Parceiro Maker" : "Cliente"}` 
                  : (loginRole === "ADMIN" ? "Gestão de Rede (Admin)" : loginRole === "MAKER" ? "Acesso do Fabricante (Maker)" : "Acesso do Cliente (STL)")
                }
              </h3>
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  setIsSignUp(false);
                  setLoginEmail("");
                  setLoginPassword("");
                  setSignupName("");
                  setSignupConfirmPassword("");
                  setLoginError("");
                }}
                className={`transition cursor-pointer ${
                  theme === "dark" ? "text-[#71717a] hover:text-white" : "text-[#71717a] hover:text-[#111]"
                }`}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="p-6 space-y-4">
              {loginError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-medium">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="warning" size={14} /> {loginError}
                  </span>
                </div>
              )}

              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-xs text-[#71717a] uppercase tracking-wider font-bold block">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Seu Nome Completo"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2.5 text-xs border focus:outline-none focus:border-[#d44d00] transition ${
                      theme === "dark" ? "bg-[#050506] border-[#18181b] text-white" : "bg-[#fafafa] border-[#e4e4ea] text-[#111]"
                    }`}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-[#71717a] uppercase tracking-wider font-bold block">Endereço de E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@seuprovedor.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2.5 text-xs border focus:outline-none focus:border-[#d44d00] transition ${
                    theme === "dark" ? "bg-[#050506] border-[#18181b] text-white" : "bg-[#fafafa] border-[#e4e4ea] text-[#111]"
                  }`}
                />
              </div>

              {(!isSignUp && loginRole === "CLIENT") ? (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-[#71717a] uppercase tracking-wider font-bold block">Senha (Opcional se conta automática)</label>
                  </div>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2.5 text-xs border focus:outline-none focus:border-[#d44d00] transition ${
                      theme === "dark" ? "bg-[#050506] border-[#18181b] text-white" : "bg-[#fafafa] border-[#e4e4ea] text-[#111]"
                    }`}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-[#71717a] uppercase tracking-wider font-bold block">Senha de Acesso</label>
                    {!isSignUp && loginRole === "ADMIN" && (
                      <span className="text-xs text-[#71717a] lowercase italic">dica: admin123</span>
                    )}
                    {!isSignUp && loginRole === "MAKER" && (
                      <span className="text-xs text-[#71717a] lowercase italic">MVP: roda@ / 123</span>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2.5 text-xs border focus:outline-none focus:border-[#d44d00] transition ${
                      theme === "dark" ? "bg-[#050506] border-[#18181b] text-white" : "bg-[#fafafa] border-[#e4e4ea] text-[#111]"
                    }`}
                  />
                </div>
              )}

              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-xs text-[#71717a] uppercase tracking-wider font-bold block">Confirmar Senha</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2.5 text-xs border focus:outline-none focus:border-[#d44d00] transition ${
                      theme === "dark" ? "bg-[#050506] border-[#18181b] text-white" : "bg-[#fafafa] border-[#e4e4ea] text-[#111]"
                    }`}
                  />
                </div>
              )}

              {!isSignUp && loginRole === "CLIENT" && (
                <p className="text-[10px] text-[#71717a] leading-relaxed italic">
                  * Para fins de testes e demonstração da cotação STL, se o e-mail digitado não existir e nenhuma senha for informada, uma conta de cliente será criada de forma automática.
                </p>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer text-center flex items-center justify-center gap-2"
              >
                {loginLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                    {isSignUp ? "Criando Conta..." : "Autenticando..."}
                  </>
                ) : (
                  isSignUp ? "Criar Minha Conta" : "Acessar Plataforma"
                )}
              </button>
              
              <div className="pt-2 flex flex-col items-center gap-2 text-[10px] text-[#71717a] mono-text">
                {loginRole !== "ADMIN" && (
                  <span 
                    onClick={() => {
                      setIsSignUp(prev => !prev);
                      setLoginEmail("");
                      setLoginPassword("");
                      setSignupName("");
                      setSignupConfirmPassword("");
                      setLoginError("");
                    }}
                    className="hover:text-white transition cursor-pointer underline font-bold text-[#d44d00]"
                  >
                    {isSignUp ? "Já tem uma conta? Faça Login" : "Não tem uma conta? Cadastre-se"}
                  </span>
                )}
                
                <span 
                  onClick={() => {
                    setLoginRole(prev => 
                      prev === "MAKER" ? "CLIENT" : 
                      prev === "CLIENT" ? "ADMIN" : "MAKER"
                    );
                    setIsSignUp(false);
                    setLoginEmail("");
                    setLoginPassword("");
                    setSignupName("");
                    setSignupConfirmPassword("");
                    setLoginError("");
                  }}
                  className="hover:text-white transition cursor-pointer underline"
                >
                  Alternar perfil (Fab / Seed / Admin)
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}
