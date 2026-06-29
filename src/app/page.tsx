"use client";

import { useState, useRef, DragEvent, ChangeEvent, useEffect } from "react";
import Image from "next/image";
import logoImg from "../logo/logo.png";
import { PRINTER_PRESETS } from "../lib/printerPresets";

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
  makerStatus: "UNVERIFIED" | "PENDING_APPROVAL" | "SANDBOX" | "HOMOLOGATED" | "BANNED";
  kycDocumentUrl?: string;
  kycSelfieUrl?: string;
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "client" | "maker" | "admin">("home");
  
  // --- ESTADOS DE SESSÃO E AUTENTICAÇÃO REAL ---
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: string; makerStatus?: string } | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [homeMode, setHomeMode] = useState<"client" | "maker">("client");
  const [contratoAceito, setContratoAceito] = useState<boolean>(false);
  
  const [lojaInsumos, setLojaInsumos] = useState<Array<{ id: string; title: string; price: number; link: string; affiliateCommissionPercent: number; image: string; deliveryTime: string }>>([
    { id: "ins1", title: "Filamento PLA Premium 1kg - GTMax3D", price: 119.90, link: "https://shopee.com.br/filamento-pla-gtmax", affiliateCommissionPercent: 5, image: "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?w=300&auto=format&fit=crop&q=60", deliveryTime: "3 a 7 dias úteis" },
    { id: "ins2", title: "Bico Extrusor de Latão V6 0.4mm", price: 15.00, link: "https://shopee.com.br/bico-extrusor-latao-v6", affiliateCommissionPercent: 10, image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=60", deliveryTime: "2 a 5 dias úteis" },
    { id: "ins3", title: "Resina Standard UV 1kg - Creality", price: 189.00, link: "https://shopee.com.br/resina-standard-uv-creality", affiliateCommissionPercent: 4, image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&auto=format&fit=crop&q=60", deliveryTime: "4 a 8 dias úteis" }
  ]);
  const [novoInsumoTitle, setNovoInsumoTitle] = useState<string>("");
  const [novoInsumoPrice, setNovoInsumoPrice] = useState<string>("");
  const [novoInsumoLink, setNovoInsumoLink] = useState<string>("");
  const [novoInsumoCommission, setNovoInsumoCommission] = useState<string>("");
  const [novoInsumoImage, setNovoInsumoImage] = useState<string>("");
  const [novoInsumoDelivery, setNovoInsumoDelivery] = useState<string>("");
  
  // --- ESTADOS DA ÁREA DO CLIENTE EXPANDIDA ---
  const [clientSubTab, setClientSubTab] = useState<"upload" | "gallery" | "search" | "ai">("upload");
  const [webSearchQuery, setWebSearchQuery] = useState<string>("");
  const [webSearchResults, setWebSearchResults] = useState<Array<{ id: string; title: string; image: string; author: string; likes: number; source: string; stlName: string; weightG: number; timeFormatted: string; totalPrice: number }>>([]);
  const [webSearchLoading, setWebSearchLoading] = useState<boolean>(false);
  
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string; recommendedParams?: { filename: string; material: string; infill: number; weightG: number; timeFormatted: string; totalPrice: number } }>>([
    {
      role: "assistant",
      text: "Olá! Eu sou o FabMakers AI, seu assistente inteligente 3D. Me diga o que você precisa fabricar (ou descreva um objeto que viu na internet) e eu indicarei o modelo ideal, o melhor material (PLA, PETG, ABS) e as configurações ideais de preenchimento para cotação!"
    }
  ]);
  const [aiInputText, setAiInputText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [loginRole, setLoginRole] = useState<"CLIENT" | "MAKER" | "ADMIN">("CLIENT");
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>("");
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
 
  // Fila de solicitações de Homologação de Makers para o Admin
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

  // --- ESTADOS DO FATIADOR STL (Aba Cliente) ---
  const [file, setFile] = useState<File | null>(null);
  const [material, setMaterial] = useState<string>("PLA");
  const [infill, setInfill] = useState<number>(20);
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

  // --- LÓGICA DE PERSISTÊNCIA EM BANCO DE DADOS REAL ---
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
    fetch("/api/orders")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.orders) {
          setOrders(prev => {
            const existingIds = new Set(prev.map(o => o.id));
            const newOrders = data.orders.filter((o: any) => !existingIds.has(o.id));
            return [...prev, ...newOrders];
          });
        }
      })
      .catch(err => console.error("Erro ao carregar ordens do banco:", err));

    // 3. Carrega homologações do banco de dados
    fetch("/api/admin")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.homologations) {
          setHomologations(prev => {
            const existingNames = new Set(prev.map(h => h.name));
            const newHomologations = data.homologations.filter((h: any) => !existingNames.has(h.name));
            return [...prev, ...newHomologations];
          });
        }
      })
      .catch(err => console.error("Erro ao carregar homologações do banco:", err));
  }, []);

  // --- LÓGICA DE SIMULAÇÃO EM SEGUNDO PLANO ---
  
  // Simulação de Progresso de Impressão (Fila)
  useEffect(() => {
    const interval = setInterval(() => {
      setOrders(prevOrders => 
        prevOrders.map(order => {
          if (order.status === "PRINTING" && order.progress < 100) {
            const nextProgress = order.progress + 5;
            if (nextProgress >= 100) {
              return { ...order, progress: 100, status: "SHIPPED" };
            }
            return { ...order, progress: nextProgress };
          }
          return order;
        })
      );
    }, 4000);
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

  // --- FUNÇÕES DO CLIENTE (COTAÇÃO & COMPRA) ---
  const generateQuote = async (uploadedFile: File, selectedMaterial: string, selectedInfill: number) => {
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", uploadedFile);
    formData.append("material", selectedMaterial);
    formData.append("infill", selectedInfill.toString());

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
      setFile(selectedFile);
      generateQuote(selectedFile, material, infill);
    }
  };

  const handleMaterialChange = (newMaterial: string) => {
    setMaterial(newMaterial);
    if (file) {
      generateQuote(file, newMaterial, infill);
    }
  };

  const handleSimulateExample = () => {
    setFile(new File([], "engrenagem_cafeteira_reposicao.stl"));
    setLoading(true);
    setTimeout(() => {
      setQuote({
        success: true,
        filename: "engrenagem_cafeteira_reposicao.stl",
        trianglesCount: 48260,
        boundingBox: { width: 45.5, depth: 45.5, height: 12.0 },
        metrics: { rawVolumeMm3: 18500, realVolumeCm3: 8.14, weightG: 10.1, timeHours: 0.56, timeFormatted: "34 min" },
        pricing: { materialCost: 1.21, machineCost: 6.72, makerProfit: 3.17, makerPayout: 11.10, platformFee: 2.78, royaltyPrice: 0.0, totalPrice: 13.88 }
      });
      setLoading(false);
    }, 1200);
  };

  const handleClear = () => {
    setFile(null);
    setQuote(null);
    setError(null);
  };

  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleInfillChange = (newInfill: number) => {
    setInfill(newInfill);
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
    
    const newOrder: SimulatedOrder = {
      id: Math.floor(1000 + Math.random() * 9000).toString(),
      filename: quote.filename,
      status: "WAITING_MAKER",
      totalPrice: quote.pricing.totalPrice,
      weightG: quote.metrics.weightG,
      timeFormatted: quote.metrics.timeFormatted,
      progress: 0,
      material: material,
      zipCode: clientZip,
      infill: infill,
      createdAt: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
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
    alert(`Pedido #${newOrder.id} enviado para o roteador geolocalizado! Os makers nas proximidades receberão o Push.`);
  };

  // --- FUNÇÕES DO MAKER (WIZARD & DESPACHO SOB DEMANDA) ---
  
  // Concluir cadastro do Maker (Envia solicitação para aprovação do Admin)
  const handleRegisterMaker = () => {
    if (!wizardName || !wizardZip) {
      alert("Por favor, preencha o Nome e o CEP.");
      return;
    }
    if (!emailVerified) {
      alert("Por favor, verifique seu e-mail antes de prosseguir.");
      return;
    }
    if (!contractAccepted) {
      alert("Por favor, aceite os termos do contrato para prosseguir.");
      return;
    }
    if (!kycDocumentName || !kycSelfieName) {
      alert("Por favor, envie seu documento de identificação e selfie.");
      return;
    }
    if (!calibImageName) {
      alert("Por favor, envie a foto da medição do cubo de calibração.");
      return;
    }

    const newProfile: MakerProfile = {
      name: wizardName,
      zipCode: wizardZip,
      rating: 5.0,
      penalties: 0,
      isBanned: false,
      isApproved: false, // Requer aprovação do Admin
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
      makerStatus: "PENDING_APPROVAL", // Aguardando aprovação do Admin
      kycDocumentUrl: kycDocumentName,
      kycSelfieUrl: kycSelfieName,
      calibX: calibX,
      calibY: calibY,
      calibZ: calibZ,
      calibImageUrl: calibImageName
    };

    setMakerProfile(newProfile);

    // Persistência real no banco de dados
    fetch("/api/maker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newProfile,
        email: wizardEmail
      })
    }).catch(err => console.error("Erro ao salvar perfil no banco:", err));

    // Enviar solicitação de homologação completa para o Admin
    const newRequest: HomologationRequest = {
      id: `req-${Math.floor(100 + Math.random() * 900)}`,
      name: wizardName,
      zipCode: wizardZip,
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

  // Aceitar Job (Roteamento P2P)
  const acceptJob = () => {
    if (!activeJobOffer || !makerProfile) return;

    // Atualiza o pedido
    setOrders(prev => 
      prev.map(o => o.id === activeJobOffer.id 
        ? { ...o, status: "PRINTING", makerName: makerProfile.name } 
        : o
      )
    );
    setActiveJobOffer(null);
    alert(`Trabalho #${activeJobOffer.id} aceito com sucesso! Iniciando fatiamento e conexão G-Code...`);
  };

  // Rejeitar Job (Roteamento P2P)
  const rejectJob = () => {
    if (!activeJobOffer) return;
    setActiveJobOffer(null);
    setOrders(prev => 
      prev.map(o => o.id === activeJobOffer.id ? { ...o, status: "WAITING_MAKER" } : o)
    );
  };

  // Desistir do Job ativo (Penalização)
  const cancelActiveJob = (orderId: string) => {
    if (!makerProfile) return;

    const currentPenalties = makerProfile.penalties + 1;
    const nextRating = Math.max(1.0, parseFloat((makerProfile.rating - 0.5).toFixed(1)));
    const shouldBan = currentPenalties >= 3 || nextRating < 4.0;

    const updatedProfile = {
      ...makerProfile,
      penalties: currentPenalties,
      rating: nextRating,
      isBanned: shouldBan
    };

    setMakerProfile(updatedProfile);
    
    // Atualiza a lista de makers no Admin
    setSystemMakers(prev => 
      prev.map(m => m.name === makerProfile.name ? updatedProfile : m)
    );

    // Volta o status do pedido para WAITING_MAKER para outro aceitar
    setOrders(prev => 
      prev.map(o => o.id === orderId ? { ...o, status: "WAITING_MAKER", makerName: undefined } : o)
    );

    if (shouldBan) {
      alert("ALERTA DE SEGURANÇA: Você acumulou excesso de penalidades ou reputação insatisfatória e foi BANIDO da comunidade FAB MAKERS.");
    } else {
      alert(`Job cancelado. Penalidade aplicada: Reputação caiu para ${nextRating}★ (Penalidades: ${currentPenalties}/3).`);
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: nextBanned ? "BAN" : "UNBAN", name })
    }).catch(err => console.error("Erro ao alterar banimento no banco:", err));
  };

  // Simula busca em repositórios 3D (Thingiverse, Printables, MakerWorld)
  const handleWeb3DSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!webSearchQuery.trim()) return;
    setWebSearchResults([]);
    setWebSearchLoading(true);
    
    // Simulação com tempo de resposta real e dados rústicos ricos
    setTimeout(() => {
      const query = webSearchQuery.toLowerCase().trim();
      const mockDb = [
        { id: "w1", title: "Suporte de Fone Minimalista", image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=300&auto=format&fit=crop&q=60", author: "3D_Master", likes: 342, source: "MakerWorld", stlName: "suporte_fone_v2.stl", weightG: 45.2, timeFormatted: "2h 15min", totalPrice: 32.50 },
        { id: "w2", title: "Suporte de Controle Xbox / PS5", image: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=300&auto=format&fit=crop&q=60", author: "GamerPrint", likes: 891, source: "Thingiverse", stlName: "xbox_controller_holder.stl", weightG: 38.0, timeFormatted: "1h 50min", totalPrice: 28.90 },
        { id: "w3", title: "Vaso de Flores Geométrico", image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&auto=format&fit=crop&q=60", author: "Flora3D", likes: 1205, source: "Printables", stlName: "geometric_vase_spiral.stl", weightG: 55.0, timeFormatted: "2h 45min", totalPrice: 38.00 },
        { id: "w4", title: "Organizador de Cabos de Mesa", image: "https://images.unsplash.com/photo-1558489823-84aac22827d2?w=300&auto=format&fit=crop&q=60", author: "NeatDesk", likes: 532, source: "Creality Cloud", stlName: "desk_cable_clip.stl", weightG: 12.5, timeFormatted: "40 min", totalPrice: 15.80 },
        { id: "w5", title: "Gancho de Bicicleta Reforçado", image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=300&auto=format&fit=crop&q=60", author: "ToughPrints", likes: 624, source: "Printables", stlName: "bike_wall_hook_heavy.stl", weightG: 120.0, timeFormatted: "6h 10min", totalPrice: 85.00 },
        { id: "w6", title: "Engrenagem Mecânica M10", image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=60", author: "Eng3D", likes: 142, source: "MakerOnline", stlName: "gear_m10_spur.stl", weightG: 22.0, timeFormatted: "1h 10min", totalPrice: 22.40 }
      ];

      // Filtra os resultados com base na busca
      const filtered = mockDb.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.stlName.toLowerCase().includes(query)
      );

      setWebSearchResults(filtered.length > 0 ? filtered : mockDb.slice(0, 3));
      setWebSearchLoading(false);
    }, 1200);
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
          setActiveTab("client");
        } else if (data.user.role === "MAKER") {
          setActiveTab("maker");
          if (data.user.profile) {
            setMakerProfile(data.user.profile);
          } else {
            setMakerProfile(null);
          }
        } else if (data.user.role === "ADMIN") {
          setActiveTab("admin");
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

  // Realizar o logout
  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab("home");
    setMakerProfile(null);
  };

  return (
    <div className={`min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-[#d44d00]/30 selection:text-white transition-colors duration-300 ${theme}`}>
      
      {/* HEADER TÉCNICO - Minimalista, com logo PNG calibrado */}
      <header className="border-b border-[#18181b] bg-background sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div 
              className="flex items-center cursor-pointer"
              onClick={() => {
                if (currentUser) {
                  if (currentUser.role === "CLIENT") setActiveTab("client");
                  else if (currentUser.role === "MAKER") setActiveTab("maker");
                  else if (currentUser.role === "ADMIN") setActiveTab("admin");
                } else {
                  setActiveTab("home");
                }
              }}
            >
              <Image 
                src={logoImg} 
                alt="FAB MAKERS" 
                className={`h-16 w-auto select-none transition-all duration-300 ${theme === "light" ? "invert" : ""}`}
                priority 
              />
            </div>

            {/* Perfil do usuário logado (exibido em vez das abas de navegação globais) */}
            {currentUser && (
              <div className="hidden md:flex items-center gap-2.5">
                <span className="text-[9px] px-2 py-0.5 bg-[#18181b] border border-[#27272a] text-[#a1a1aa] rounded uppercase font-bold tracking-wider mono-text">
                  {currentUser.role === "ADMIN" ? "ADMIN" : currentUser.role === "MAKER" ? "MAKER PARTNER" : "CLIENTE"}
                </span>
                <span className="text-xs text-[#27272a]">|</span>
                <span className="text-xs text-[#a1a1aa] font-medium">Logado como: <span className="text-white font-bold">{currentUser.name}</span></span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Alternador de Tema Híbrido (Light/Dark) */}
            <button
              onClick={() => setTheme(prev => prev === "dark" ? "light" : "dark")}
              className="p-2 border border-[#18181b] hover:bg-[#18181b]/30 rounded-md transition text-xs font-semibold text-[#a1a1aa] hover:text-white cursor-pointer"
              title={theme === "dark" ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {!currentUser ? (
              <>
                <button
                  onClick={() => {
                    setLoginRole("CLIENT");
                    setLoginEmail("");
                    setLoginPassword("");
                    setLoginError("");
                    setShowLoginModal(true);
                  }}
                  className="text-xs bg-[#d44d00] hover:bg-[#b04000] text-white px-4 py-2 font-medium transition rounded-md cursor-pointer"
                >
                  Entrar na Plataforma
                </button>
                <a
                  href="/pitch_fabmakers.html"
                  target="_blank"
                  className="hidden sm:inline-block text-xs font-medium border border-[#18181b] text-[#a1a1aa] hover:text-white bg-[#09090b] hover:bg-[#18181b] px-4 py-2 transition rounded-md"
                >
                  Apresentação & Pitch
                </a>
              </>
            ) : (
              <>
                <button
                  onClick={handleLogout}
                  className="text-xs border border-red-500/20 text-red-400 hover:text-white hover:bg-red-500/20 px-4 py-2 font-medium transition rounded-md cursor-pointer"
                >
                  Sair (Logout)
                </button>
              </>
            )}
          </div>
        </div>
        
      </header>

      {/* CONTEÚDO DINÂMICO DE ABAS */}
      <main className="flex-grow">

        {/* TAB 1: HOME (APRESENTAÇÃO CORPORATIVA E PORTAIS DE ACESSO) */}
        {activeTab === "home" && (
          <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
            
            {/* SWITCH DE VISÃO PRINCIPAL (MKT DUAL) */}
            <div className="flex justify-center pb-4 border-b border-[#18181b]/45">
              <div className="bg-[#09090b] border border-[#18181b] rounded-lg p-1.5 flex flex-wrap gap-2">
                <button
                  onClick={() => setHomeMode("client")}
                  className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md transition cursor-pointer flex items-center gap-2 ${
                    homeMode === "client" 
                      ? "bg-[#d44d00] text-white" 
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  🛍️ Comprar Serviços de Impressão (Cliente)
                </button>
                <button
                  onClick={() => setHomeMode("maker")}
                  className={`px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md transition cursor-pointer flex items-center gap-2 ${
                    homeMode === "maker" 
                      ? "bg-[#d44d00] text-white" 
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  ⚙️ Produzir Serviços / Ver Loja (Maker/Empresa)
                </button>
              </div>
            </div>

            {/* MODO CLIENTE: VITRINE DE PROJETOS E PROPOSTAS STL */}
            {homeMode === "client" && (
              <div className="space-y-16">
                {/* Hero do Cliente */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-4">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d44d00]/10 border border-[#d44d00]/20 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d44d00] animate-pulse"></span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#d44d00] mono-text">Impressão 3D Despachada Localmente</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-none">
                      Não tem impressora? <br />
                      <span className="text-[#d44d00]">Nós fabricamos e entregamos para você.</span>
                    </h1>
                    <p className="text-xs text-[#a1a1aa] leading-relaxed max-w-xl">
                      Cote seu modelo 3D em segundos. Roteamos sua peça para a rede de makers locais (hobbistas e bureaus industriais). O primeiro fabricante disponível aceita a cotação e inicia a produção imediatamente. Intermediação digital segura sob demanda!
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                      <button
                        onClick={() => {
                          if (currentUser) {
                            setActiveTab("client");
                            setClientSubTab("upload");
                          } else {
                            setLoginRole("CLIENT");
                            setLoginEmail("");
                            setLoginPassword("");
                            setLoginError("");
                            setShowLoginModal(true);
                          }
                        }}
                        className="px-6 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                      >
                        ⚡ Enviar STL & Cotar Agora
                      </button>
                      <button
                        onClick={() => {
                          const element = document.getElementById("populares-makerworld");
                          if (element) element.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="px-6 py-3 border border-[#18181b] text-white hover:bg-[#18181b]/50 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                      >
                        🔍 Ver Modelos Populares
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <div className="bg-[#09090b] border border-[#18181b] rounded-lg p-6 space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#d44d00]/5 rounded-full blur-3xl"></div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Como Funciona o Fluxo</h3>
                      <div className="space-y-4 text-xs">
                        <div className="flex gap-3">
                          <span className="w-5 h-5 rounded bg-[#18181b] text-[#d44d00] font-bold flex items-center justify-center flex-shrink-0 border border-[#27272a]">1</span>
                          <div>
                            <h4 className="font-bold text-white">Escolha ou Envie o Arquivo</h4>
                            <p className="text-[10px] text-[#71717a] mt-0.5">Importe do MakerWorld ou envie seu arquivo de engenharia STL.</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <span className="w-5 h-5 rounded bg-[#18181b] text-[#d44d00] font-bold flex items-center justify-center flex-shrink-0 border border-[#27272a]">2</span>
                          <div>
                            <h4 className="font-bold text-white">Orçamento Fatiado na Hora</h4>
                            <p className="text-[10px] text-[#71717a] mt-0.5">Calculamos peso, tempo de máquina e custo exato em 0.12 segundos.</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <span className="w-5 h-5 rounded bg-[#18181b] text-[#d44d00] font-bold flex items-center justify-center flex-shrink-0 border border-[#27272a]">3</span>
                          <div>
                            <h4 className="font-bold text-white">Despacho sob Demanda</h4>
                            <p className="text-[10px] text-[#71717a] mt-0.5">Ao confirmar o pedido logado, a ordem vai para o radar geral e o primeiro maker local aceita e inicia a manufatura.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Grid Integrado do MakerWorld / Printables */}
                <div id="populares-makerworld" className="space-y-6 pt-6 border-t border-[#18181b]/50">
                  <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-tight mono-text">Ideias e Modelos Populares (MakerWorld & Printables)</h2>
                    <p className="text-xs text-[#a1a1aa] mt-1">
                      Pesquise ou clique em qualquer modelo abaixo para importá-lo instantaneamente e receber seu orçamento físico.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { id: "mw1", title: "Suporte de Fone Minimalista", image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=300&auto=format&fit=crop&q=60", weightG: 45.0, author: "Bambu_User", source: "MakerWorld", stlName: "fone_minimalista.stl", price: 32.50 },
                      { id: "mw2", title: "Organizador Modular de Gavetas", image: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=300&auto=format&fit=crop&q=60", weightG: 68.0, author: "Print_Lab", source: "Printables", stlName: "gaveta_modular.stl", price: 44.90 },
                      { id: "mw3", title: "Vaso Espiral Geométrico", image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&auto=format&fit=crop&q=60", weightG: 55.0, author: "VaseDesign", source: "MakerWorld", stlName: "vaso_espiral.stl", price: 38.00 },
                      { id: "mw4", title: "Gancho de Bicicleta Reforçado", image: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=300&auto=format&fit=crop&q=60", weightG: 120.0, author: "Tough3D", source: "MakerWorld", stlName: "gancho_bike.stl", price: 85.00 }
                    ].map((item) => (
                      <div key={item.id} className="bg-[#09090b] border border-[#18181b] rounded-lg overflow-hidden flex flex-col justify-between hover:border-[#d44d00]/30 transition group">
                        <div className="aspect-video w-full relative overflow-hidden bg-[#18181b]">
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          <span className="absolute top-2 right-2 bg-[#d44d00] text-white text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mono-text">{item.source}</span>
                        </div>
                        <div className="p-4 flex-grow flex flex-col justify-between space-y-4">
                          <div>
                            <h4 className="font-bold text-white text-xs leading-snug truncate">{item.title}</h4>
                            <p className="text-[9px] text-[#71717a] mt-0.5">Criado por: {item.author}</p>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-[#18181b]/50">
                            <span className="text-xs font-bold text-[#d44d00] mono-text">Est. R$ {item.price.toFixed(2)}</span>
                            <button
                              onClick={() => {
                                // Injeta os dados da galeria no Quote
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
                                    timeFormatted: "2h 15min"
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
                                  setActiveTab("client");
                                  setClientSubTab("upload");
                                } else {
                                  setLoginRole("CLIENT");
                                  setLoginEmail("");
                                  setLoginPassword("");
                                  setLoginError("");
                                  setShowLoginModal(true);
                                }
                              }}
                              className="px-2.5 py-1 bg-[#d44d00] hover:bg-[#b04000] text-[9px] font-bold text-white uppercase rounded transition cursor-pointer"
                            >
                              Imprimir Peça
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* MODO MAKER: LOJA DE INSUMOS E RENTABILIZAÇÃO DE IMPRESSORAS */}
            {homeMode === "maker" && (
              <div className="space-y-16">
                {/* Hero do Maker */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center py-4">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#d44d00]/10 border border-[#d44d00]/20 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d44d00] animate-pulse"></span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#d44d00] mono-text">Adesão Gratuita & 5% de Comissão</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white leading-none">
                      Sua impressora 3D está ociosa? <br />
                      <span className="text-[#d44d00]">Ganhe dinheiro produzindo na nossa rede.</span>
                    </h1>
                    <p className="text-xs text-[#a1a1aa] leading-relaxed max-w-xl">
                      Seja você uma pessoa física com uma máquina no quarto ou uma empresa/bureau com dezenas de equipamentos. A FabMakers conecta você a clientes locais de forma inteligente. Sem taxas fixas: cobramos apenas 5% de intermediação sobre os pedidos que você produzir!
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                      <button
                        onClick={() => {
                          if (currentUser && currentUser.role === "MAKER") {
                            setActiveTab("maker");
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
                        🚀 Quero Produzir / Credenciar Máquina
                      </button>
                      <button
                        onClick={() => {
                          const element = document.getElementById("insumos-shopee");
                          if (element) element.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="px-6 py-3 border border-[#18181b] text-white hover:bg-[#18181b]/50 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                      >
                        🛒 Comprar/Revender Insumos
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-5 bg-[#09090b] border border-[#18181b] rounded-lg p-6 space-y-4">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Oportunidade Comercial</h3>
                    <ul className="space-y-3 text-xs text-[#a1a1aa] list-disc pl-4 leading-relaxed">
                      <li><strong className="text-white">Taxa Fixa Zero:</strong> Sem custo de filiação mensal.</li>
                      <li><strong className="text-white">Taxa Amigável de 5%:</strong> Cobrada apenas do valor do serviço repassado.</li>
                      <li><strong className="text-white">Programa de Afiliados:</strong> Divulgue produtos da nossa loja de insumos e receba comissões diretas de até 10% do valor do produto sem precisar de estoque!</li>
                      <li><strong className="text-white">Empresas e Físicas:</strong> Aceitamos cadastros CPF e CNPJ com repasse bancário quinzenal.</li>
                    </ul>
                  </div>
                </div>

                {/* Loja de Insumos & Afiliados */}
                <div id="insumos-shopee" className="space-y-6 pt-6 border-t border-[#18181b]/50">
                  <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-tight mono-text">Loja de Insumos & Dropshipping de Parceiros</h2>
                    <p className="text-xs text-[#a1a1aa] mt-1">
                      Compre insumos com desconto de fornecedores homologados (Shopee/TikTok Shop) ou gere links de afiliados para revender.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {lojaInsumos.map((prod) => (
                      <div key={prod.id} className="bg-[#09090b] border border-[#18181b] rounded-lg p-5 flex flex-col justify-between space-y-4 hover:border-[#d44d00]/30 transition group">
                        <div className="space-y-3">
                          <div className="aspect-square w-full rounded bg-[#18181b] overflow-hidden">
                            <img src={prod.image} alt={prod.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                          </div>
                          <div>
                            <span className="text-[8px] bg-[#18181b] text-[#d44d00] border border-[#d44d00]/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider mono-text inline-block">Dropshipping Parceiro</span>
                            <h4 className="font-bold text-white text-xs leading-snug mt-1.5">{prod.title}</h4>
                            <p className="text-[10px] text-[#71717a] mt-0.5">Prazo: {prod.deliveryTime}</p>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2 border-t border-[#18181b]/50">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-extrabold text-white mono-text">R$ {prod.price.toFixed(2)}</span>
                            <span className="text-[9px] text-[#10b981] font-bold">Comissão: {prod.affiliateCommissionPercent}%</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <a
                              href={prod.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] text-center text-[9px] font-bold text-white uppercase rounded transition"
                            >
                              🛒 Comprar
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
                              className="py-1.5 bg-[#d44d00] hover:bg-[#b04000] text-[9px] font-bold text-white uppercase rounded transition cursor-pointer"
                            >
                              🔗 Revender
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

        {/* TAB 2: PAINEL CLIENTE (STL + HISTÓRICO + MAPA RASTREAMENTO) */}
        {activeTab === "client" && (
          <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
            
            {/* SUB-ABAS DA JORNADA DO CLIENTE */}
            <div className="flex flex-wrap gap-2 border-b border-[#18181b]/50 pb-4">
              <button
                onClick={() => setClientSubTab("upload")}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                  clientSubTab === "upload"
                    ? "bg-[#d44d00] text-white"
                    : "border border-[#18181b] text-[#a1a1aa] hover:text-white bg-[#09090b]"
                }`}
              >
                📁 Fatiador STL
              </button>
              <button
                onClick={() => setClientSubTab("gallery")}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                  clientSubTab === "gallery"
                    ? "bg-[#d44d00] text-white"
                    : "border border-[#18181b] text-[#a1a1aa] hover:text-white bg-[#09090b]"
                }`}
              >
                🖼️ Galeria de Modelos
              </button>
              <button
                onClick={() => setClientSubTab("search")}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                  clientSubTab === "search"
                    ? "bg-[#d44d00] text-white"
                    : "border border-[#18181b] text-[#a1a1aa] hover:text-white bg-[#09090b]"
                }`}
              >
                🌐 Buscar na Web 3D
              </button>
              <button
                onClick={() => setClientSubTab("ai")}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                  clientSubTab === "ai"
                    ? "bg-[#d44d00] text-white"
                    : "border border-[#18181b] text-[#a1a1aa] hover:text-white bg-[#09090b]"
                }`}
              >
                🤖 Assistente de IA 3D
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              
              {/* Lado Esquerdo: Ferramenta Dinâmica de acordo com a Sub-Aba selecionada */}
              <div className="lg:col-span-7 space-y-8">
                
                {/* 1. Sub-Aba: UPLOAD STL (Fatiador atual) */}
                {clientSubTab === "upload" && (
                  <>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-white uppercase mono-text">Área de Cotação de Geometria</h2>
                      <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                        Faça o upload do seu arquivo STL. Nosso motor calcula instantaneamente o faturamento e inicia o roteamento para a fazenda de impressão mais próxima.
                      </p>
                    </div>

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
                            : "border-[#18181b] hover:border-[#27272a] bg-[#09090b]"
                      }`}
                    >
                      <input ref={fileInputRef} type="file" accept=".stl" onChange={handleFileChange} className="hidden" />

                      {!file ? (
                        <div className="space-y-4">
                          <div className="w-10 h-10 rounded bg-[#18181b] flex items-center justify-center mx-auto border border-[#27272a]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#a1a1aa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          </div>
                          <div>
                            <button onClick={handleBrowseFiles} className="text-[#d44d00] hover:text-[#b04000] font-semibold text-xs cursor-pointer">
                              Selecione seu arquivo STL
                            </button>
                            <p className="text-[10px] text-[#71717a] mt-1">Arraste o arquivo geométrico</p>
                          </div>
                          <button onClick={handleSimulateExample} className="text-[9px] mono-text text-[#a1a1aa] hover:text-white bg-[#18181b] px-3 py-1.5 rounded border border-[#27272a] transition cursor-pointer">
                            💡 Usar Engrenagem de Exemplo
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center bg-[#18181b]/50 border border-[#27272a] p-4 rounded">
                          <div className="flex items-center gap-3 text-left">
                            <div className="w-8 h-8 rounded bg-[#10b981]/15 text-[#10b981] flex items-center justify-center border border-[#10b981]/20">
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h4 className="font-semibold text-white text-xs truncate max-w-[200px] mono-text">{file.name}</h4>
                              <p className="text-[9px] text-[#71717a]">Arquivo de engenharia carregado</p>
                            </div>
                          </div>
                          <button onClick={handleClear} className="text-[#71717a] hover:text-red-400 p-1.5 hover:bg-[#18181b] rounded transition">
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Parâmetros */}
                    <div className="technical-panel rounded p-6 space-y-6">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-3">Configurações Físicas</h3>
                      
                      <div className="space-y-3">
                        <label className="text-[10px] font-semibold text-[#a1a1aa] uppercase tracking-wider mono-text">Material do Filamento</label>
                        <div className="grid grid-cols-4 gap-2">
                          {["PLA", "ABS", "PETG", "Resina"].map((mat) => (
                            <button
                              key={mat}
                              onClick={() => handleMaterialChange(mat)}
                              className={`p-2 border text-xs font-semibold transition rounded cursor-pointer ${
                                material === mat ? "border-[#d44d00] bg-[#d44d00]/5 text-white" : "border-[#18181b] bg-[#050506] text-[#71717a] hover:border-[#27272a]"
                              }`}
                            >
                              {mat}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] text-[#a1a1aa] uppercase tracking-wider mono-text">
                          <label>Densidade Interna (Infill)</label>
                          <span className="text-[#d44d00]">{infill}%</span>
                        </div>
                        <input
                          type="range" min="10" max="100" step="5" value={infill}
                          onChange={(e) => handleInfillChange(parseInt(e.target.value))}
                          className="w-full accent-[#d44d00] h-1 bg-[#18181b] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 2. Sub-Aba: GALERIA DE MODELOS PRONTOS */}
                {clientSubTab === "gallery" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-white uppercase mono-text">Galeria da Rede FabMakers</h2>
                      <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                        Escolha um dos modelos homologados e criados por designers da nossa rede para imprimir diretamente.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {[
                        { id: "g1", title: "Suporte de Fone de Ouvido", image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=300&auto=format&fit=crop&q=60", weightG: 45.0, timeFormatted: "2h 15min", totalPrice: 32.50, material: "PLA", stlName: "suporte_fone_v2.stl" },
                        { id: "g2", title: "Vaso de Decoração Espiral", image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=300&auto=format&fit=crop&q=60", weightG: 55.0, timeFormatted: "2h 45min", totalPrice: 38.00, material: "PLA", stlName: "geometric_vase.stl" },
                        { id: "g3", title: "Suporte de Controle Xbox", image: "https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?w=300&auto=format&fit=crop&q=60", weightG: 38.0, timeFormatted: "1h 50min", totalPrice: 28.90, material: "PLA", stlName: "xbox_stand.stl" },
                        { id: "g4", title: "Gancho de Parede Reforçado", image: "https://images.unsplash.com/photo-1558489823-84aac22827d2?w=300&auto=format&fit=crop&q=60", weightG: 120.0, timeFormatted: "6h 10min", totalPrice: 85.00, material: "PETG", stlName: "bike_hook.stl" }
                      ].map((item) => (
                        <div key={item.id} className="bg-[#09090b] border border-[#18181b] rounded-lg overflow-hidden flex flex-col justify-between hover:border-[#d44d00]/30 transition group">
                          <div className="aspect-video w-full relative overflow-hidden bg-[#18181b]">
                            <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                            <span className="absolute top-2 right-2 bg-[#d44d00] text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mono-text">Royalty Zero</span>
                          </div>
                          <div className="p-4 space-y-4 flex-grow flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-white text-sm leading-tight">{item.title}</h4>
                              <p className="text-[10px] text-[#71717a] mt-1">Material sugerido: <span className="text-[#a1a1aa] font-bold">{item.material}</span> | Peso: {item.weightG}g</p>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-[#18181b]/50">
                              <span className="text-sm font-extrabold text-white mono-text">R$ {item.totalPrice.toFixed(2)}</span>
                              <button
                                onClick={() => {
                                  // Injeta os dados da galeria no Quote
                                  setFile(new File([new ArrayBuffer(100)], item.stlName, { type: "application/sla" }));
                                  setMaterial(item.material);
                                  setQuote({
                                    success: true,
                                    filename: item.stlName,
                                    trianglesCount: 15420,
                                    boundingBox: { width: 120, depth: 80, height: 160 },
                                    metrics: {
                                      rawVolumeMm3: 36000,
                                      realVolumeCm3: 36.0,
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
                                className="px-3 py-1.5 bg-[#d44d00] hover:bg-[#b04000] text-white text-[10px] font-bold rounded uppercase tracking-wider transition cursor-pointer"
                              >
                                Selecionar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Sub-Aba: BUSCA WEB 3D */}
                {clientSubTab === "search" && (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-white uppercase mono-text">Pesquisa Integrada Web 3D</h2>
                      <p className="text-xs text-[#a1a1aa] mt-1 leading-relaxed">
                        Pesquise modelos prontos em repositórios abertos mundiais (MakerWorld, Printables, Thingiverse) e importe diretamente para cotação.
                      </p>
                    </div>

                    <form onSubmit={handleWeb3DSearch} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Busque por 'suporte xbox', 'gancho', 'vaso'..."
                        value={webSearchQuery}
                        onChange={(e) => setWebSearchQuery(e.target.value)}
                        className="flex-grow bg-[#09090b] border border-[#18181b] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                      <button
                        type="submit"
                        disabled={webSearchLoading}
                        className="px-6 py-2 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer flex items-center gap-2"
                      >
                        {webSearchLoading ? "Buscando..." : "Pesquisar"}
                      </button>
                    </form>

                    {webSearchLoading && (
                      <div className="py-12 text-center">
                        <div className="w-8 h-8 rounded-full border border-dashed border-[#71717a] border-t-[#d44d00] animate-spin mx-auto"></div>
                        <p className="text-[10px] text-[#71717a] mt-3">Agregando resultados das APIs globais 3D...</p>
                      </div>
                    )}

                    {!webSearchLoading && webSearchResults.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {webSearchResults.map((item) => (
                          <div key={item.id} className="bg-[#09090b] border border-[#18181b] p-4 rounded-lg flex gap-4 items-center hover:border-[#d44d00]/30 transition">
                            <div className="w-20 h-20 rounded bg-[#18181b] overflow-hidden flex-shrink-0">
                              <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-grow space-y-1.5 min-w-0">
                              <span className="text-[8px] bg-[#18181b] text-[#a1a1aa] px-1.5 py-0.5 rounded border border-[#27272a] uppercase font-bold tracking-wider mono-text inline-block">{item.source}</span>
                              <h4 className="font-bold text-white text-xs truncate leading-tight">{item.title}</h4>
                              <p className="text-[9px] text-[#71717a] truncate">Por: {item.author} | {item.likes} likes</p>
                              <button
                                onClick={() => {
                                  // Injeta os dados da busca no Quote
                                  setFile(new File([new ArrayBuffer(100)], item.stlName, { type: "application/sla" }));
                                  setMaterial("PLA");
                                  setQuote({
                                    success: true,
                                    filename: item.stlName,
                                    trianglesCount: 12450,
                                    boundingBox: { width: 100, depth: 100, height: 120 },
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
                                  setClientZip("01001-000");
                                  alert(`Modelo "${item.title}" importado com sucesso da ${item.source}! Agora informe o CEP para fechar o pedido.`);
                                  setClientSubTab("upload"); // Joga para a cotação fatiador
                                }}
                                className="text-[10px] text-[#d44d00] hover:text-[#b04000] font-bold uppercase tracking-wider block cursor-pointer"
                              >
                                Importar e Cotar →
                              </button>
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
                                <span className="text-[9px] uppercase tracking-wider font-bold text-[#d44d00] block mono-text">Parâmetros de Fabricação Sugeridos</span>
                                <div className="grid grid-cols-2 gap-2 text-[10px] text-[#71717a] border-b border-[#18181b] pb-2">
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
                                    className="px-2.5 py-1 bg-[#d44d00] hover:bg-[#b04000] text-white text-[9px] font-bold rounded uppercase tracking-wider transition cursor-pointer"
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

            {/* Lado Direito: Resultados, Histórico de Pedidos e Rastreamento */}
            <div className="lg:col-span-5 space-y-8">
              
              {/* Resultado Cotação */}
              {quote ? (
                <div className="technical-panel rounded p-6 space-y-5">
                  <div className="text-center pb-4 border-b border-[#18181b]">
                    <span className="text-[9px] font-semibold text-[#71717a] uppercase tracking-wider mono-text">Valor da Peça</span>
                    <div className="text-3xl font-extrabold text-[#d44d00] mt-1 mono-text">
                      R$ {quote.pricing.totalPrice.toFixed(2).replace(".", ",")}
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-xs text-[#a1a1aa] mono-text">
                    <div className="flex justify-between"><span>Tempo Máquina</span><span>{quote.metrics.timeFormatted}</span></div>
                    <div className="flex justify-between"><span>Peso Extrudado</span><span>{quote.metrics.weightG}g</span></div>
                    <div className="flex justify-between"><span>Material</span><span>{material}</span></div>
                    <div className="flex justify-between"><span>Dimensões Peça</span><span>{quote.boundingBox.width.toFixed(1)} x {quote.boundingBox.depth.toFixed(1)} x {quote.boundingBox.height.toFixed(1)} mm</span></div>
                  </div>

                  {/* Campo de CEP do Cliente (ViaCEP) */}
                  <div className="space-y-1.5 border-t border-[#18181b] pt-4">
                    <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">CEP de Entrega para Cotação Logística</label>
                    <input 
                      type="text" value={clientZip} 
                      onChange={(e) => handleClientZipChange(e.target.value)} 
                      placeholder="Ex: 13083-970" 
                      className="w-full bg-[#050506] border border-[#18181b] rounded p-2.5 text-xs text-white focus:border-[#d44d00] focus:outline-none transition" 
                    />
                    {clientZipLoading && <p className="text-[9px] text-yellow-500 mono-text animate-pulse">Buscando localidade e calculando frete...</p>}
                    {clientAddress && <p className="text-[10px] text-[#10b981] font-semibold mono-text mt-0.5">📍 {clientAddress}</p>}
                  </div>

                  {/* Sonar / Radar de Proximidade */}
                  {clientZip && (
                    <div className="border border-[#18181b] rounded p-4 bg-[#050506] space-y-3">
                      <div className="flex justify-between items-center text-[9px] text-[#71717a] uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">
                        <span>Radar de Proximidade</span>
                        <span className={isScanningRadar ? "text-yellow-500 animate-pulse" : "text-[#10b981]"}>
                          {isScanningRadar ? "Escaneando Rede..." : "Rede Pronta"}
                        </span>
                      </div>

                      {isScanningRadar ? (
                        <div className="flex flex-col items-center justify-center py-6 space-y-3 relative overflow-hidden">
                          {/* Animação do sonar */}
                          <div className="w-12 h-12 rounded-full border border-[#d44d00]/30 flex items-center justify-center animate-ping absolute"></div>
                          <div className="w-20 h-20 rounded-full border border-[#d44d00]/20 flex items-center justify-center animate-ping absolute"></div>
                          
                          <svg className="w-10 h-10 text-[#d44d00] animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="text-[9px] text-[#71717a] mono-text">Escaneando e avaliando compatibilidades de mesa/câmara...</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {nearbyMakers.length > 0 ? (
                            <div className="space-y-2">
                              <p className="text-[9px] text-[#71717a] uppercase tracking-wider mono-text">Makers locais avaliados pela rede:</p>
                              {nearbyMakers.map((maker, idx) => {
                                const presetMatch = PRINTER_PRESETS.find(p => `${p.brand} ${p.model}` === maker.machine);
                                
                                const width = quote.boundingBox.width;
                                const depth = quote.boundingBox.depth;
                                const height = quote.boundingBox.height;
                                
                                const fitsVolume = presetMatch 
                                  ? (presetMatch.volumeX >= width && presetMatch.volumeY >= depth && presetMatch.volumeZ >= height)
                                  : true;
                                  
                                const requiresEnclosure = material === "ABS" || material === "ASA";
                                const meetsEnclosure = presetMatch 
                                  ? (requiresEnclosure ? presetMatch.hasEnclosure : true)
                                  : true;
                                  
                                const isCompatible = fitsVolume && meetsEnclosure;

                                return (
                                  <div key={idx} className={`p-2.5 rounded border text-[10px] space-y-1.5 ${
                                    isCompatible ? "border-[#10b981]/20 bg-[#10b981]/2" : "border-red-500/20 bg-red-500/2"
                                  }`}>
                                    <div className="flex justify-between items-center">
                                      <span className="font-bold text-white">{maker.name} <span className="text-[#a1a1aa] font-normal text-[9px]">({maker.distanceKm} km)</span></span>
                                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded mono-text ${
                                        isCompatible ? "bg-[#10b981]/15 text-[#10b981]" : "bg-red-500/15 text-red-500"
                                      }`}>
                                        {isCompatible ? `Disponível (ETA: ${maker.etaMinutes} min)` : "Incompatível"}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] text-[#71717a]">
                                      <span>Máquina: {maker.machine}</span>
                                      <span>Nota: ★{maker.rating.toFixed(1)}</span>
                                    </div>
                                    {!isCompatible && (
                                      <p className="text-[8px] text-red-400 font-semibold mono-text mt-0.5 flex items-center gap-1">
                                        ⚠️ Motivo: {!fitsVolume 
                                          ? `Mesa útil (${presetMatch?.volumeX}x${presetMatch?.volumeY}x${presetMatch?.volumeZ}mm) menor que a peça` 
                                          : "Material exige impressora fechada (Câmara térmica ABS/ASA)"}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[9px] text-[#71717a] text-center py-2">Nenhum maker retornado.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    onClick={dispatchOrder}
                    disabled={clientZip.replace(/\D/g, "").length !== 8 || nearbyMakers.filter(m => {
                      const preset = PRINTER_PRESETS.find(p => `${p.brand} ${p.model}` === m.machine);
                      const fitsVol = preset ? (preset.volumeX >= quote.boundingBox.width && preset.volumeY >= quote.boundingBox.depth && preset.volumeZ >= quote.boundingBox.height) : true;
                      const meetsEnc = (material === "ABS" || material === "ASA") ? (preset ? preset.hasEnclosure : true) : true;
                      return fitsVol && meetsEnc;
                    }).length === 0}
                    className={`w-full py-3 text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer ${
                      clientZip.replace(/\D/g, "").length === 8 && nearbyMakers.filter(m => {
                        const preset = PRINTER_PRESETS.find(p => `${p.brand} ${p.model}` === m.machine);
                        const fitsVol = preset ? (preset.volumeX >= quote.boundingBox.width && preset.volumeY >= quote.boundingBox.depth && preset.volumeZ >= quote.boundingBox.height) : true;
                        const meetsEnc = (material === "ABS" || material === "ASA") ? (preset ? preset.hasEnclosure : true) : true;
                        return fitsVol && meetsEnc;
                      }).length > 0
                        ? "bg-[#d44d00] hover:bg-[#b04000]"
                        : "bg-[#18181b] border border-[#27272a] text-[#71717a] cursor-not-allowed"
                    }`}
                  >
                    Despachar para Fabricação Local
                  </button>
                  {clientZip && nearbyMakers.length > 0 && nearbyMakers.filter(m => {
                    const preset = PRINTER_PRESETS.find(p => `${p.brand} ${p.model}` === m.machine);
                    const fitsVol = preset ? (preset.volumeX >= quote.boundingBox.width && preset.volumeY >= quote.boundingBox.depth && preset.volumeZ >= quote.boundingBox.height) : true;
                    const meetsEnc = (material === "ABS" || material === "ASA") ? (preset ? preset.hasEnclosure : true) : true;
                    return fitsVol && meetsEnc;
                  }).length === 0 && (
                    <p className="text-[9px] text-red-400 text-center font-semibold mt-1">
                      ⚠️ Nenhum Maker no raio atende aos requisitos físicos/térmicos desta peça/material.
                    </p>
                  )}
                </div>
              ) : (
                <div className="technical-panel rounded p-10 text-center flex flex-col items-center justify-center min-h-[180px]">
                  <p className="text-xs text-[#71717a]">Aguardando fatiamento para gerar cotação técnica.</p>
                </div>
              )}

              {/* Rastreamento de Pedidos do Cliente */}
              <div className="technical-panel rounded p-6 space-y-6">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-3">Seus Pedidos & Rastreamento</h3>
                
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                  {orders.map((ord) => (
                    <div key={ord.id} className="border border-[#18181b] p-4 rounded space-y-3 bg-[#09090b]/40">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-white mono-text">PEDIDO #{ord.id}</span>
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
                      
                      <div className="text-[11px] text-[#71717a] space-y-1">
                        <p className="truncate">Peça: <span className="text-white">{ord.filename}</span></p>
                        <p>Fabricado por: <span className="text-white">{ord.makerName || "Procurando parceiro..."}</span></p>
                        <p>Total: <span className="text-[#d44d00] font-bold">R$ {ord.totalPrice.toFixed(2).replace(".", ",")}</span></p>
                      </div>

                      {/* Mapa Simulado de Rotas para os pedidos em andamento */}
                      {(ord.status === "PRINTING" || ord.status === "SHIPPED" || ord.status === "WAITING_MAKER") && (
                        <div className="pt-2">
                          <span className="text-[8px] uppercase tracking-widest text-[#71717a] block mb-1.5 mono-text">Distribuição Regionalizada (Mapa)</span>
                          <div className="h-16 bg-[#050506] border border-[#18181b] rounded relative overflow-hidden flex items-center justify-center">
                            {/* Grid do mapa de fundo */}
                            <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:10px_10px] opacity-40"></div>
                            
                            {/* Conexão da rota */}
                            <svg className="absolute inset-0 w-full h-full">
                              {ord.status !== "WAITING_MAKER" && (
                                <line x1="30" y1="30" x2="160" y2="30" stroke="#d44d00" strokeWidth="1" strokeDasharray="4 4" className="animate-[dash_2s_linear_infinite]" />
                              )}
                            </svg>
                            
                            {/* Pontos de Roteamento */}
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center">
                              <span className={`w-2.5 h-2.5 rounded-full ${ord.status === "WAITING_MAKER" ? "bg-yellow-500 animate-ping" : "bg-[#d44d00]"} border border-white/10`}></span>
                              <span className="text-[7px] text-[#71717a] mt-1 mono-text">Maker</span>
                            </div>
                            
                            {ord.status !== "WAITING_MAKER" && (
                              <div className={`absolute left-1/2 top-1/2 -translate-y-1/2 ${ord.status === "PRINTING" ? "text-yellow-500" : "text-[#10b981]"} text-[8px] px-1.5 py-0.5 bg-[#09090b] border border-[#18181b] rounded mono-text z-10`}>
                                {ord.status === "PRINTING" ? "⚙️ IMPRIMINDO" : "🚚 EM TRÂNSITO"}
                              </div>
                            )}

                            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col items-center">
                              <span className="w-2.5 h-2.5 rounded-full bg-white border border-white/10"></span>
                              <span className="text-[7px] text-[#71717a] mt-1 mono-text">Cliente</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* TAB 3: PAINEL MAKER (CADASTRO PASSO A PASSO + NOTIFICAÇÕES SOB DEMANDA + REPUTAÇÃO E BANIMENTO) */}
        {activeTab === "maker" && (
          <div className="max-w-7xl mx-auto px-6 py-12">
{/* 1. SE O MAKER NÃO ESTÁ CADASTRADO: WIZARD DE CADASTRO DETALHADO */}
            {!makerProfile ? (
              <div className="max-w-3xl mx-auto space-y-8">
                <div className="border-b border-[#18181b] pb-4">
                  <h2 className="text-xl font-bold text-white uppercase tracking-tight mono-text">Formulário de Entrada - Maker</h2>
                  {/* Indicador de passos */}
                </div>
                <div className="flex justify-between text-[9px] text-[#71717a] font-semibold uppercase tracking-wider mono-text border-b border-[#18181b] pb-3">
                  <span className={wizardStep === 1 ? "text-[#d44d00]" : ""}>1. Conta & E-mail</span>
                  <span className={wizardStep === 2 ? "text-[#d44d00]" : ""}>2. Contrato SLA</span>
                  <span className={wizardStep === 3 ? "text-[#d44d00]" : ""}>3. Máquinas</span>
                  <span className={wizardStep === 4 ? "text-[#d44d00]" : ""}>4. Estoque</span>
                  <span className={wizardStep === 5 ? "text-[#d44d00]" : ""}>5. Carga & KYC</span>
                </div>

                <div className="technical-panel p-6 rounded-lg space-y-6">
                  {/* PASSO 1: CONTA & E-MAIL (ZOHO SMTP) */}
                  {wizardStep === 1 && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Criação de Credenciais & Confirmação de E-mail</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">E-mail Corporativo</label>
                          <input 
                            type="email" value={wizardEmail} onChange={(e) => setWizardEmail(e.target.value)} placeholder="maker@dominio.com" 
                            className="w-full bg-[#050506] border border-[#18181b] rounded p-2.5 text-xs text-white focus:border-[#d44d00] focus:outline-none transition" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Senha de Acesso</label>
                          <input 
                            type="password" value={wizardPassword} onChange={(e) => setWizardPassword(e.target.value)} placeholder="••••••••" 
                            className="w-full bg-[#050506] border border-[#18181b] rounded p-2.5 text-xs text-white focus:border-[#d44d00] focus:outline-none transition" 
                          />
                        </div>
                      </div>

                      {/* Simulação do Envio de E-mail via Zoho SMTP */}
                      <div className="border border-[#18181b] rounded p-4 bg-[#050506] space-y-4">
                        <div className="flex justify-between items-center text-[10px] mono-text">
                          <span className="text-[#a1a1aa] uppercase font-bold">Status do E-mail</span>
                          <span className={emailVerified ? "text-[#10b981]" : "text-yellow-500 animate-pulse"}>
                            {emailVerified ? "📧 Verificado com sucesso!" : "Aguardando Verificação"}
                          </span>
                        </div>

                        {!emailSent ? (
                          <button
                            onClick={() => {
                              if (!wizardEmail || !wizardPassword) {
                                alert("Informe e-mail e senha primeiro!");
                                return;
                              }
                              setEmailSent(true);
                              alert("Disparando e-mail de validação corporativa via Zoho Mail SMTP...");
                            }}
                            className="w-full py-2 bg-[#d44d00] hover:bg-[#b04000] text-white text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer"
                          >
                            Enviar Link de Confirmação (Zoho SMTP)
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-[10px] text-[#71717a] text-center">
                              Enviamos um e-mail com token de segurança para <strong className="text-white">{wizardEmail}</strong>. 
                              Use o botão abaixo para simular que você clicou no link de validação no seu e-mail:
                            </p>
                            <button
                              onClick={() => {
                                setEmailVerificationLoading(true);
                                setTimeout(() => {
                                  setEmailVerified(true);
                                  setEmailVerificationLoading(false);
                                  alert("Conta verificada no banco SQLite/Turso via token!");
                                }, 1000);
                              }}
                              disabled={emailVerificationLoading || emailVerified}
                              className={`w-full py-2 text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer ${
                                emailVerified 
                                  ? "bg-[#10b981]/20 border border-[#10b981]/30 text-[#10b981]" 
                                  : "bg-[#18181b] border border-[#27272a] text-white hover:bg-[#27272a]"
                              }`}
                            >
                              {emailVerificationLoading ? "Verificando token..." : emailVerified ? "✓ E-mail Confirmado!" : "🔗 Simular Clique no Link do E-mail"}
                            </button>
                          </div>
                        )}
                      </div>

                      <button 
                        onClick={() => setWizardStep(2)} 
                        disabled={!emailVerified}
                        className={`w-full py-2.5 font-bold text-xs uppercase tracking-wider rounded transition ${
                          emailVerified 
                            ? "bg-white text-black hover:bg-[#e4e4e7] cursor-pointer" 
                            : "bg-[#18181b] border border-[#27272a] text-[#71717a] cursor-not-allowed"
                        }`}
                      >
                        Avançar para Contrato SLA
                      </button>
                    </div>
                  )}

                  {/* PASSO 2: CONTRATO SLA (INTERMEDIAÇÃO DESCENTRALIZADA) */}
                  {wizardStep === 2 && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Contrato de Credenciamento, Parceria & Isenção Tributária (Taxa 5%)</h3>
                      
                      {/* Corpo do Contrato */}
                      <div className="h-64 overflow-y-auto border border-[#18181b] p-4 bg-[#050506] rounded space-y-4 text-[10px] text-[#a1a1aa] leading-relaxed">
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mono-text">1. DA NATUREZA DA INTERMEDIAÇÃO DIGITAL P2P</h4>
                        <p>
                          A FAB MAKERS atua exclusivamente como provedora de infraestrutura tecnológica e de intermediação comercial. A plataforma conecta de forma algorítmica a lei da oferta e da procura: de um lado, clientes demandantes de peças customizadas; de outro, Makers (Pessoas Físicas operando hardware ocioso doméstico ou Empresas/Bureaus corporativos de manufatura). O Maker declara estar ciente de que não há qualquer vínculo empregatício ou societário com a FAB MAKERS.
                        </p>
                        
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mono-text">2. DA TAXA DE COMISSÃO DE 5%</h4>
                        <p className="text-white font-semibold">
                          O credenciamento na plataforma é 100% gratuito. Pela intermediação tecnológica e facilitação de cobrança, a FAB MAKERS reterá o percentual fixo de 5% (cinco por cento) sobre o valor bruto de cada serviço de manufatura executado e faturado na plataforma. O repasse financeiro de 95% do valor líquido será depositado de forma digital e quinzenal na conta bancária do parceiro cadastrado.
                        </p>

                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mono-text">3. DA ISENÇÃO DE RESPONSABILIDADE FISCAL E HARDWARE</h4>
                        <p>
                          O Maker assume inteira e exclusiva responsabilidade pelos custos de hardware de sua operação (energia elétrica, depreciação física de bicos/extrusoras, compra de filamentos, falhas de impressão e perdas de material). A FAB MAKERS atua apenas na facilitação do pagamento. A nota fiscal dos insumos e produtos comprados via dropshipping é de responsabilidade do fornecedor original, cabendo ao Maker a regularização de seus serviços de fabricação perante os órgãos tributários.
                        </p>

                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mono-text">4. DO SIGILO DOS ARQUIVOS E PROPRIEDADE INTELECTUAL</h4>
                        <p className="text-white font-semibold">
                          Os arquivos geométricos (STL, OBJ, STEP, etc.) enviados pelos clientes são de propriedade intelectual exclusiva dos mesmos. O Maker obriga-se a manter sigilo absoluto sobre tais arquivos, comprometendo-se a deletá-los de seus sistemas e fatiadores locais logo após a conclusão física e despacho da ordem. É expressamente proibido revender, distribuir, arquivar ou reproduzir as peças dos clientes para fins comerciais próprios. O descumprimento gera banimento imediato e instauração de responsabilidade civil e criminal.
                        </p>

                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mono-text">5. DA NÃO CONCORRÊNCIA E CANAL EXCLUSIVO</h4>
                        <p>
                          Fica vedado ao Maker negociar diretamente ou receber pagamentos por fora dos clientes apresentados originalmente pela FAB MAKERS. O desvio de canal ensejará multa correspondente ao triplo da média de faturamento mensal do parceiro, além do bloqueio permanente e retenção de saldos para indenização de prejuízos.
                        </p>
                      </div>

                      {/* Caixa de Aceite */}
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input 
                          type="checkbox" checked={contractAccepted} 
                          onChange={(e) => setContractAccepted(e.target.checked)} 
                          className="mt-0.5 accent-[#d44d00]" 
                        />
                        <span className="text-[10px] text-[#71717a] leading-tight">
                          Declaro que li, compreendi e concordo com todos os termos do Contrato de Credenciamento de 5% da FAB MAKERS, assumindo total responsabilidade pelo sigilo das peças 3D e calibração dimensional.
                        </span>
                      </label>

                      <div className="flex gap-4">
                        <button onClick={() => setWizardStep(1)} className="flex-1 py-2.5 border border-[#18181b] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer">
                          Voltar
                        </button>
                        <button 
                          onClick={() => setWizardStep(3)} 
                          disabled={!contractAccepted}
                          className={`flex-1 py-2.5 font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer ${
                            contractAccepted 
                              ? "bg-white text-black hover:bg-[#e4e4e7]" 
                              : "bg-[#18181b] border border-[#27272a] text-[#71717a] cursor-not-allowed"
                          }`}
                        >
                          Avançar para Máquinas
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASSO 3: MÁQUINAS (ANTIGO PASSO 1) */}
                  {wizardStep === 3 && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Informações Pessoais & Cadastro de Equipamentos</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Nome Completo</label>
                          <input 
                            type="text" value={wizardName} onChange={(e) => setWizardName(e.target.value)} placeholder="Ex: Maria Souza" 
                            className="w-full bg-[#050506] border border-[#18181b] rounded p-2.5 text-xs text-white focus:border-[#d44d00] focus:outline-none transition" 
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">CEP de Atuação</label>
                          <input 
                            type="text" value={wizardZip} 
                            onChange={(e) => handleMakerZipChange(e.target.value)} 
                            placeholder="Ex: 13083-970" 
                            className="w-full bg-[#050506] border border-[#18181b] rounded p-2.5 text-xs text-white focus:border-[#d44d00] focus:outline-none transition" 
                          />
                          {makerZipLoading && <p className="text-[9px] text-yellow-500 mono-text animate-pulse">Buscando localidade...</p>}
                          {makerZipFeedback && <p className="text-[10px] text-[#10b981] font-semibold mono-text mt-0.5">📍 {makerZipFeedback}</p>}
                        </div>
                      </div>

                      {/* Lista de Máquinas */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Suas Impressoras 3D</label>
                          <button onClick={addMachine} className="text-[10px] text-[#d44d00] hover:underline font-bold">+ Adicionar Máquina</button>
                        </div>
                        
                        {wizardMachines.map((mach, index) => {
                          const filteredModels = PRINTER_PRESETS.filter(p => p.brand === mach.brand).map(p => p.model);
                          const isCustom = !mach.brand || mach.brand === "Personalizada";
                          
                          return (
                            <div key={mach.id} className="border border-[#18181b] p-4 rounded bg-[#050506] space-y-4">
                              <div className="flex justify-between items-center text-xs font-bold text-[#a1a1aa] border-b border-[#18181b] pb-2">
                                <span className="mono-text text-[9px] tracking-wider text-[#71717a]">MÁQUINA #{index + 1}</span>
                                {wizardMachines.length > 1 && (
                                  <button 
                                    onClick={() => setWizardMachines(wizardMachines.filter(m => m.id !== mach.id))}
                                    className="text-red-500 hover:text-red-400 font-normal hover:underline text-[10px]"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text">Fabricante</label>
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
                                    className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white focus:outline-none focus:border-[#d44d00]" 
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
                                    <label className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text">Modelo do Equipamento</label>
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
                                      className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white focus:outline-none focus:border-[#d44d00]"
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
                                      className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white focus:outline-none focus:border-[#d44d00]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text">Modelo Livre</label>
                                    <input 
                                      type="text" value={mach.model} placeholder="Ex: Ender 3 V2"
                                      onChange={(e) => {
                                        const newM = [...wizardMachines];
                                        newM[index].model = e.target.value;
                                        setWizardMachines(newM);
                                      }}
                                      className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white focus:outline-none focus:border-[#d44d00]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text">Volume (XxYxZ mm)</label>
                                    <input 
                                      type="text" value={mach.volume} placeholder="Ex: 220x220x250mm"
                                      onChange={(e) => {
                                        const newM = [...wizardMachines];
                                        newM[index].volume = e.target.value;
                                        setWizardMachines(newM);
                                      }}
                                      className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white focus:outline-none focus:border-[#d44d00]"
                                    />
                                  </div>
                                </div>
                              ) : (
                                mach.model && (
                                  <div className="bg-[#09090b] border border-[#18181b] p-3 rounded text-[10px] text-[#a1a1aa] space-y-2 mono-text">
                                    <div className="grid grid-cols-3 gap-y-1.5 gap-x-2">
                                      <p>Tecnologia: <span className="text-white">{mach.technology}</span></p>
                                      <p>Volume Útil: <span className="text-white">{mach.volume}</span></p>
                                      <p>Câmara: <span className="text-white">{mach.hasEnclosure ? "Fechada (Sim)" : "Aberta (Não)"}</span></p>
                                      <p>Multicor: <span className="text-white">{mach.hasMulticolor ? "Suporta AMS/MMU" : "Não"}</span></p>
                                      <p>Bico Máx: <span className="text-white">{mach.maxNozzleTemp}°C</span></p>
                                      <p>Mesa Máx: <span className="text-white">{mach.maxBedTemp}°C</span></p>
                                      <p>Velocidade: <span className="text-white">{mach.maxSpeed} mm/s</span></p>
                                      <p>Precisão: <span className="text-white">±{mach.typicalPrecision} mm</span></p>
                                      <p>Carga Máx Z: <span className="text-white">{mach.maxPartWeightG}g</span></p>
                                    </div>
                                    <div className="border-t border-[#18181b] pt-1.5 text-[9px]">
                                      <p className="truncate">Materiais Compatíveis: <span className="text-white">{(mach.compatibleMaterials || []).join(", ")}</span></p>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-4">
                        <button onClick={() => setWizardStep(2)} className="flex-1 py-2.5 border border-[#18181b] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer">
                          Voltar
                        </button>
                        <button onClick={() => setWizardStep(4)} className="flex-1 py-2.5 bg-white text-black font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer">
                          Avançar para Insumos
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASSO 4: INSUMOS EM ESTOQUE (ANTIGO PASSO 2) */}
                  {wizardStep === 4 && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Controle de Filamento & Matéria-Prima</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Seu Estoque de Filamento</label>
                          <button onClick={addFilament} className="text-[10px] text-[#d44d00] hover:underline font-bold">+ Adicionar Filamento</button>
                        </div>
                        {wizardFilaments.map((fil, index) => (
                          <div key={fil.id} className="border border-[#18181b] p-3 rounded grid grid-cols-3 gap-2 bg-[#050506]">
                            <select 
                              value={fil.type} 
                              onChange={(e) => {
                                const newF = [...wizardFilaments];
                                newF[index].type = e.target.value;
                                setWizardFilaments(newF);
                              }}
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-[#a1a1aa] focus:outline-none"
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
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white focus:outline-none focus:border-[#d44d00]" 
                            />
                            <input 
                              type="number" value={fil.weightG} placeholder="Peso em Gramas" 
                              onChange={(e) => {
                                const newF = [...wizardFilaments];
                                newF[index].weightG = parseInt(e.target.value) || 0;
                                setWizardFilaments(newF);
                              }}
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white focus:outline-none focus:border-[#d44d00]" 
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-4">
                        <button onClick={() => setWizardStep(3)} className="flex-1 py-2.5 border border-[#18181b] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer">
                          Voltar
                        </button>
                        <button onClick={() => setWizardStep(5)} className="flex-1 py-2.5 bg-white text-black font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer">
                          Avançar para Carga & KYC
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASSO 5: CARGA OPERACIONAL, KYC E CALIBRAÇÃO */}
                  {wizardStep === 5 && (
                    <div className="space-y-6">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wider mono-text border-b border-[#18181b] pb-2">Capacidade Diária, Verificação KYC e Calibração Técnica</h3>
                      
                      {/* Calendário interativo de escala */}
                      <div className="space-y-4">
                        <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Grade de Escala Semanal (Escolha os dias de Trabalho)</label>
                        
                        <div className="grid grid-cols-7 gap-2 text-center text-xs">
                          {["seg", "ter", "qua", "qui", "sex", "sab", "dom"].map((day) => (
                            <div key={day} className="space-y-2">
                              <span className="font-bold text-[#a1a1aa] uppercase tracking-widest text-[9px] mono-text">{day}</span>
                              <button 
                                onClick={() => {
                                  const isEscalado = wizardDays.includes(day);
                                  toggleDay(day);
                                  setWizardDailyHours(prev => ({
                                    ...prev,
                                    [day]: isEscalado ? 0 : 8
                                  }));
                                }}
                                className={`w-full py-2 border rounded font-semibold text-[10px] uppercase transition cursor-pointer ${
                                  wizardDays.includes(day) ? "border-[#d44d00] bg-[#d44d00]/5 text-white" : "border-[#18181b] bg-[#050506] text-[#71717a]"
                                }`}
                              >
                                {wizardDays.includes(day) ? "Escalado" : "Folga"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Ajuste de horas da máquina por dia da semana */}
                      {wizardDays.length > 0 && (
                        <div className="space-y-4 border-t border-[#18181b] pt-4">
                          <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Capacidade Horária por Dia (Carga Máquina)</label>
                          <div className="space-y-2">
                            {wizardDays.map((day) => (
                              <div key={day} className="flex justify-between items-center gap-4 bg-[#09090b] border border-[#18181b] p-2.5 rounded text-xs">
                                <span className="font-bold text-white uppercase mono-text w-12">{day}</span>
                                <input 
                                  type="range" min="1" max="24" step="1"
                                  value={wizardDailyHours[day] !== undefined ? wizardDailyHours[day] : 8}
                                  onChange={(e) => {
                                    setWizardDailyHours(prev => ({
                                      ...prev,
                                      [day]: parseInt(e.target.value)
                                    }));
                                  }}
                                  className="flex-1 accent-[#d44d00] h-1 bg-[#18181b] rounded-lg appearance-none cursor-pointer"
                                />
                                <span className="text-[#d44d00] font-bold w-16 text-right mono-text">
                                  {wizardDailyHours[day] !== undefined ? wizardDailyHours[day] : 8} horas
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Mostrador de Capacidade Máquina Total Semanal */}
                          <div className="bg-[#10b981]/5 border border-[#10b981]/15 p-4 rounded-lg space-y-2 mono-text text-xs text-[#10b981]">
                            <div className="flex justify-between items-center font-bold">
                              <span>CAPACIDADE OPERACIONAL DA REDE</span>
                              <span>
                                {wizardDays.reduce((acc, d) => acc + (wizardDailyHours[d] || 8), 0) * wizardMachines.length}h / semana
                              </span>
                            </div>
                            <p className="text-[10px] text-[#71717a] font-normal normal-case">
                              Calculado com base em {wizardMachines.length} máquina(s) cadastrada(s) na etapa 3 e horas produtivas.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* UPLOAD DE KYC (DOCUMENTOS) */}
                      <div className="border-t border-[#18181b] pt-4 space-y-4">
                        <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Documentação KYC (Verificação de Identidade)</label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <span className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text block">Documento de Identidade (RG ou CNH)</span>
                            <div className="flex items-center gap-2">
                              <label className="px-3 py-2 bg-[#050506] border border-[#18181b] rounded text-xs text-[#a1a1aa] hover:border-[#d44d00] cursor-pointer transition">
                                📁 Selecionar Arquivo
                                <input 
                                  type="file" accept="image/*" className="hidden" 
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) setKycDocumentName(e.target.files[0].name);
                                  }} 
                                />
                              </label>
                              <span className="text-[9px] text-white truncate max-w-[120px]">{kycDocumentName || "Nenhum arquivo"}</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text block">Selfie Segurando Documento</span>
                            <div className="flex items-center gap-2">
                              <label className="px-3 py-2 bg-[#050506] border border-[#18181b] rounded text-xs text-[#a1a1aa] hover:border-[#d44d00] cursor-pointer transition">
                                📸 Anexar Foto
                                <input 
                                  type="file" accept="image/*" className="hidden" 
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) setKycSelfieName(e.target.files[0].name);
                                  }} 
                                />
                              </label>
                              <span className="text-[9px] text-white truncate max-w-[120px]">{kycSelfieName || "Nenhum arquivo"}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* HOMOLOGAÇÃO DE CALIBRAÇÃO TÉCNICA (CUBO BENCHMARK) */}
                      <div className="border-t border-[#18181b] pt-4 space-y-4">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Prova de Calibração Física (Cubo Calibrado 20mm)</label>
                          <p className="text-[9px] text-[#71717a] leading-tight">
                            Faça o download e imprima o cubo de teste oficial da plataforma. Use um paquímetro para medir com precisão as faces X, Y e Z e insira os milímetros reais medidos abaixo (Tolerância máxima: ±0.05mm).
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <span className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text block">Eixo X (mm)</span>
                            <input 
                              type="number" step="0.01" value={calibX} 
                              onChange={(e) => setCalibX(parseFloat(e.target.value) || 20.00)}
                              className="w-full bg-[#050506] border border-[#18181b] rounded p-2 text-xs text-white mono-text focus:outline-none focus:border-[#d44d00]" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text block">Eixo Y (mm)</span>
                            <input 
                              type="number" step="0.01" value={calibY} 
                              onChange={(e) => setCalibY(parseFloat(e.target.value) || 20.00)}
                              className="w-full bg-[#050506] border border-[#18181b] rounded p-2 text-xs text-white mono-text focus:outline-none focus:border-[#d44d00]" 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text block">Eixo Z (mm)</span>
                            <input 
                              type="number" step="0.01" value={calibZ} 
                              onChange={(e) => setCalibZ(parseFloat(e.target.value) || 20.00)}
                              className="w-full bg-[#050506] border border-[#18181b] rounded p-2 text-xs text-white mono-text focus:outline-none focus:border-[#d44d00]" 
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text block">Foto da Medição (Cubo sendo medido com Paquímetro)</span>
                          <div className="flex items-center gap-2">
                            <label className="px-3 py-2 bg-[#050506] border border-[#18181b] rounded text-xs text-[#a1a1aa] hover:border-[#d44d00] cursor-pointer transition">
                              📷 Anexar Foto da Medição
                              <input 
                                type="file" accept="image/*" className="hidden" 
                                onChange={(e) => {
                                  if (e.target.files?.[0]) setCalibImageName(e.target.files[0].name);
                                }} 
                              />
                            </label>
                            <span className="text-[9px] text-white truncate max-w-[200px]">{calibImageName || "Nenhum arquivo"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button onClick={() => setWizardStep(4)} className="flex-1 py-2.5 border border-[#18181b] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer">
                          Voltar
                        </button>
                        <button onClick={handleRegisterMaker} className="flex-1 py-2.5 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer">
                          Concluir Cadastro & Solicitar Homologação
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // 2. SE O MAKER JÁ TEM CADASTRO
              <div className="space-y-8">
                
                {/* Cabeçalho do Maker Cadastrado com status Sandbox */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#09090b] border border-[#18181b] p-6 rounded">
                  <div>
                    <h2 className="text-lg font-bold text-white mono-text">{makerProfile.name}</h2>
                    <p className="text-xs text-[#71717a] mt-1">CEP de Atuação: <span className="text-[#a1a1aa]">{makerProfile.zipCode}</span></p>
                  </div>
                  
                  {/* Status de Aprovação do Admin */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-widest text-[#71717a] block mono-text">Avaliação da Rede</span>
                      <span className="text-sm font-bold text-white mono-text">★ {makerProfile.rating} / 5.0</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-widest text-[#71717a] block mono-text">Status de Cadastro</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase mono-text ${
                        makerProfile.isBanned ? "border-red-500/30 text-red-500 bg-red-500/5 animate-pulse" :
                        makerProfile.makerStatus === "HOMOLOGATED" ? "border-green-500/30 text-green-500 bg-green-500/5" :
                        makerProfile.makerStatus === "SANDBOX" ? "border-blue-500/30 text-blue-500 bg-blue-500/5" :
                        "border-yellow-500/30 text-yellow-500 bg-yellow-500/5"
                      }`}>
                        {makerProfile.isBanned ? "BANIDO" : 
                         makerProfile.makerStatus === "HOMOLOGATED" ? "HOMOLOGADO" : 
                         makerProfile.makerStatus === "SANDBOX" ? "SANDBOX (EXPERIÊNCIA)" : 
                         "Aguardando Auditoria"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ALERTA DE BANIDO POR PENALIDADES */}
                {makerProfile.isBanned ? (
                  <div className="border border-red-500/30 bg-red-950/20 p-8 rounded text-center space-y-4">
                    <div className="w-12 h-12 rounded bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20 text-2xl font-bold">
                      ⚠️
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
                    <div className="w-12 h-12 rounded bg-yellow-500/10 text-yellow-500 flex items-center justify-center mx-auto border border-yellow-500/20 text-2xl font-bold animate-pulse">
                      ⏳
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-yellow-500 uppercase tracking-wider mono-text">Cadastro em Auditoria de Segurança</h3>
                      <p className="text-xs text-[#a1a1aa] mt-2 max-w-lg mx-auto leading-relaxed">
                        Sua solicitação foi enviada para a fila de homologação. O administrador da plataforma auditará seus documentos KYC, selfie e a precisão dimensional do cubo de teste.
                      </p>
                      <div className="bg-[#050506] border border-[#18181b] p-4 rounded max-w-md mx-auto mt-4 text-left text-[11px] text-[#a1a1aa] space-y-1.5 mono-text">
                        <p className="font-bold text-white border-b border-[#18181b] pb-1 uppercase text-[9px] tracking-wider">Seus Dados de Calibração Física</p>
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
                    <p className="text-[10px] text-[#71717a]">
                      💡 Dica rápida: Clique em <strong>Admin</strong> no menu superior para auditar e aprovar esta solicitação manualmente!
                    </p>
                  </div>
                ) : (
                  // MAKER ATIVO (HOMOLOGADO OU SANDBOX)
                  <div className="space-y-6">
                    {/* Faixa de Sandbox */}
                    {makerProfile.makerStatus === "SANDBOX" && (
                      <div className="border border-blue-500/20 bg-blue-500/5 p-4 rounded text-xs text-[#60a5fa] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <strong className="block text-white">⚠️ Período de Sandbox Ativo (Fase de Experiência)</strong>
                          <span className="text-[11px] text-[#a1a1aa] mt-0.5 block">
                            Como novo parceiro credenciado, você está em período probatório de 3 entregas e está limitado a aceitar apenas <strong>1 job por vez</strong>.
                          </span>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded mono-text text-[10px] text-white font-bold">
                          0 de 3 Entregas Concluídas
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* RADAR DE SERVIÇOS: NOTIFICAÇÃO PUSH DE TRABALHOS PRÓXIMOS */}
                    <div className="lg:col-span-8 space-y-6">
                      
                      {/* Push Alerta Geral */}
                      {activeJobOffer ? (
                        <div className="border-2 border-[#d44d00] bg-[#d44d00]/5 p-6 rounded space-y-4 animate-pulse relative overflow-hidden">
                          {/* Efeito de laser minimalista rodando */}
                          <div className="absolute top-0 left-0 w-full h-1 bg-[#d44d00]"></div>
                          
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] uppercase tracking-widest text-[#d44d00] font-bold mono-text block">TRABALHO DIRECIONADO DISPONÍVEL (RADAR CEP)</span>
                              <h3 className="text-base font-bold text-white mono-text mt-1">{activeJobOffer.filename}</h3>
                              <p className="text-[11px] text-[#a1a1aa] mt-1">Material exigido: <span className="text-white font-bold">{activeJobOffer.material}</span> | Peso: {activeJobOffer.weightG}g</p>
                            </div>
                            
                            {/* Cronômetro de Aceite */}
                            <div className="text-right">
                              <span className="text-[8px] uppercase tracking-widest text-[#71717a] block mono-text">Timer de Aceite</span>
                              <span className="text-2xl font-bold text-red-500 mono-text">{offerTimer}s</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4 border-t border-[#18181b] pt-4 text-xs">
                            <div>
                              <span className="text-[9px] text-[#71717a] uppercase block">Tempo de Impressão</span>
                              <span className="font-bold text-white">{activeJobOffer.timeFormatted}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-[#71717a] uppercase block">Seu Ganho Líquido (95%)</span>
                              <span className="font-bold text-[#10b981]">R$ {(activeJobOffer.totalPrice * 0.95).toFixed(2).replace(".", ",")}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-[#71717a] uppercase block">Comissão Intermediação (5%)</span>
                              <span className="font-bold text-red-400">R$ {(activeJobOffer.totalPrice * 0.05).toFixed(2).replace(".", ",")}</span>
                            </div>
                          </div>

                          <div className="flex gap-4 pt-2">
                            <button
                              onClick={acceptJob}
                              className="flex-1 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer text-center"
                            >
                              Aceitar Ordem de Serviço
                            </button>
                            <button
                              onClick={rejectJob}
                              className="py-3 px-6 border border-[#18181b] text-[#a1a1aa] hover:text-white text-xs font-semibold uppercase rounded transition cursor-pointer"
                            >
                              Rejeitar
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* RADAR GERAL DESCENTRALIZADO (LEI DA OFERTA E DA PROCURA) */
                        <div className="technical-panel rounded overflow-hidden space-y-4">
                          <div className="px-6 py-4 border-b border-[#18181b] bg-[#09090b] flex justify-between items-center">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text">Radar Geral de Demandas</h3>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping"></span>
                              <span className="text-[9px] text-[#a1a1aa] font-bold uppercase tracking-wider mono-text">Buscando...</span>
                            </div>
                          </div>

                          <div className="divide-y divide-[#18181b] text-xs">
                            {orders.filter(o => o.status === "WAITING_MAKER").length === 0 ? (
                              <div className="p-10 text-center text-[#71717a] space-y-2">
                                <div className="w-8 h-8 rounded-full border border-dashed border-[#18181b] flex items-center justify-center mx-auto">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#71717a]"></span>
                                </div>
                                <h4 className="font-bold text-white uppercase text-[10px] tracking-wider mono-text">Sem pedidos pendentes no radar</h4>
                                <p className="text-[9px] text-[#71717a] max-w-xs mx-auto leading-relaxed">
                                  {makerProfile.makerStatus === "HOMOLOGATED" || makerProfile.makerStatus === "SANDBOX"
                                    ? "Você está online. Novas ordens de serviço geradas por clientes locais aparecerão no seu radar instantaneamente."
                                    : "Aguarde a aprovação e homologação técnica de sua conta pelo administrador para acessar o radar."}
                                </p>
                              </div>
                            ) : (
                              orders.filter(o => o.status === "WAITING_MAKER").map((ord) => (
                                <div key={ord.id} className="p-5 bg-[#09090b]/10 hover:bg-[#09090b]/20 transition flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-white mono-text">OFERTA #{ord.id}</span>
                                      <span className="text-[8px] bg-[#d44d00]/15 text-[#d44d00] border border-[#d44d00]/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider mono-text">Aguardando Impressão</span>
                                    </div>
                                    <p className="text-[11px] text-[#a1a1aa]">Peça: <span className="text-white">{ord.filename}</span> | CEP: {ord.zipCode}</p>
                                    <div className="text-[10px] text-[#71717a] mono-text flex gap-4">
                                      <span>Peso: {ord.weightG}g</span>
                                      <span>Material: {ord.material}</span>
                                      <span>Infill: {ord.infill || 20}%</span>
                                    </div>
                                  </div>

                                  <div className="sm:text-right space-y-2">
                                    <div>
                                      <span className="text-[8px] text-[#71717a] block uppercase tracking-wider mono-text">Seu Ganho Líquido (95%)</span>
                                      <span className="text-sm font-extrabold text-[#10b981] mono-text">R$ {(ord.totalPrice * 0.95).toFixed(2).replace(".", ",")}</span>
                                      <span className="text-[9px] text-[#71717a] block">Taxa Intermediação (5%): R$ {(ord.totalPrice * 0.05).toFixed(2)}</span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        if (makerProfile.makerStatus === "PENDING_APPROVAL") {
                                          alert("Sua conta ainda está em análise! Aguarde aprovação técnica antes de fabricar.");
                                          return;
                                        }
                                        // Aceita o pedido do radar
                                        setOrders(prev => prev.map(o => {
                                          if (o.id === ord.id) {
                                            return { ...o, status: "PRINTING", makerName: makerProfile.name, progress: 15 };
                                          }
                                          return o;
                                        }));
                                        alert(`Você assumiu a fabricação da Ordem de Serviço #${ord.id}! Verifique a aba 'Seus Trabalhos Alocados' para acompanhar.`);
                                      }}
                                      className="px-4 py-2 bg-[#d44d00] hover:bg-[#b04000] text-white text-[10px] font-bold uppercase tracking-wider rounded transition cursor-pointer"
                                    >
                                      Aceitar Serviço
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Lista de Jobs Ativos do Maker */}
                      <div className="technical-panel rounded overflow-hidden">
                        <div className="px-6 py-4 border-b border-[#18181b] bg-[#09090b] flex justify-between items-center">
                          <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text">Seus Trabalhos Alocados</h3>
                          <span className="text-[9px] text-[#71717a] mono-text">ESCALA FAB MAKERS</span>
                        </div>
                        <div className="divide-y divide-[#18181b] text-xs">
                          {orders.filter(o => o.makerName === makerProfile.name).map((ord) => (
                            <div key={ord.id} className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-[#09090b]/20">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white mono-text">JOB #{ord.id}</span>
                                  <span className={`text-[8px] font-bold px-2 py-0.5 rounded border uppercase mono-text ${
                                    ord.status === "PRINTING" ? "border-[#d44d00]/30 text-[#d44d00]" : "border-zinc-700 text-[#a1a1aa]"
                                  }`}>
                                    {ord.status === "PRINTING" ? "Imprimindo" : "Despachado"}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#71717a]">Peça: <span className="text-white">{ord.filename}</span></div>
                                <div className="text-[10px] text-[#71717a] mono-text">Volume: {ord.weightG}g | Material: {ord.material}</div>
                              </div>
                              <div className="sm:text-right space-y-2">
                                {ord.status === "PRINTING" ? (
                                  <>
                                    <div className="text-[11px] font-bold text-white">Progresso: {ord.progress}%</div>
                                    <button
                                      onClick={() => cancelActiveJob(ord.id)}
                                      className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider border border-red-500/20 bg-red-500/5 px-2.5 py-1 rounded transition cursor-pointer"
                                    >
                                      Desistir do Job (Penalidade)
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-[#10b981] font-bold uppercase tracking-wider">Despachado ao cliente</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Especificações do Maker Cadastrado */}
                    <div className="lg:col-span-4 space-y-6">
                      <div className="technical-panel p-6 rounded-lg space-y-4">
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest mono-text">Especificações do Maker</h3>
                        
                        <div className="border border-[#18181b] p-3 rounded space-y-2 bg-[#050506]">
                          <span className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text block">Impressoras Cadastradas</span>
                          {makerProfile.machines.map(m => (
                            <div key={m.id} className="text-xs font-bold text-white flex justify-between">
                              <span>{m.brand} {m.model}</span>
                              <span className="text-[#a1a1aa] font-normal">{m.nozzle}</span>
                            </div>
                          ))}
                        </div>

                        <div className="border border-[#18181b] p-3 rounded space-y-2 bg-[#050506]">
                          <span className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text block">Estoque de Filamento</span>
                          {makerProfile.filaments.map(f => (
                            <div key={f.id} className="text-xs font-bold text-white flex justify-between">
                              <span>{f.type} ({f.color})</span>
                              <span className="text-[#a1a1aa] font-normal">{f.weightG}g</span>
                            </div>
                          ))}
                        </div>

                        <div className="border border-[#18181b] p-3 rounded space-y-2 bg-[#050506]">
                          <span className="text-[8px] uppercase tracking-wider text-[#71717a] mono-text block">Disponibilidade Declarada</span>
                          <p className="text-xs font-bold text-white uppercase tracking-widest text-[9px] mono-text">Dias: {makerProfile.availability.days.join(", ")}</p>
                          <p className="text-xs text-[#a1a1aa] mt-1 leading-normal">Turnos: {makerProfile.availability.shifts.join(", ")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

        {/* TAB 4: PAINEL ADMINISTRATIVO (CONTROLE, HOMOLOGAÇÕES E MÉTRICAS DE ESCALA) */}
        {activeTab === "admin" && (
          <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
            
            <div className="border-b border-[#18181b] pb-4">
              <h2 className="text-xl font-bold text-white uppercase tracking-tight mono-text">Painel de Orquestração da Plataforma</h2>
              <p className="text-xs text-[#a1a1aa] mt-1">Supervisão técnica, homologações de qualidade e controle de banimento de makers.</p>
            </div>

            {/* Métricas de Escala */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="technical-panel p-5 rounded">
                <span className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Faturamento Bruto</span>
                <span className="text-2xl font-bold text-white block mt-1 mono-text">R$ {orders.filter(o => o.status !== "CANCELLED").reduce((acc, curr) => acc + curr.totalPrice, 0).toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="technical-panel p-5 rounded">
                <span className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Comissão Plataforma (5%)</span>
                <span className="text-2xl font-bold text-[#d44d00] block mt-1 mono-text">R$ {(orders.filter(o => o.status !== "CANCELLED").reduce((acc, curr) => acc + curr.totalPrice, 0) * 0.05).toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="technical-panel p-5 rounded">
                <span className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Makers Ativos no Grid</span>
                <span className="text-2xl font-bold text-white block mt-1 mono-text">{systemMakers.filter(m => m.isApproved && !m.isBanned).length}</span>
              </div>
              <div className="technical-panel p-5 rounded">
                <span className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Material Extrudado</span>
                <span className="text-2xl font-bold text-[#10b981] block mt-1 mono-text">{orders.filter(o => o.status === "COMPLETED").reduce((acc, curr) => acc + curr.weightG, 0).toFixed(1)}g</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Lado Esquerdo: Fila de Homologação de Makers Pendentes */}
              <div className="lg:col-span-6 space-y-6">
                <div className="technical-panel rounded overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#18181b] bg-[#09090b] flex justify-between items-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text">Homologações de Qualidade Pendentes</h3>
                    <span className="text-[8px] bg-[#d44d00]/15 text-[#d44d00] px-2 py-0.5 rounded font-bold tracking-widest">BENCHMARK 3D</span>
                  </div>

                  <div className="divide-y divide-[#18181b] text-xs">
                    {homologations.map((req) => (
                      <div key={req.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold text-white block">{req.name}</span>
                            <span className="text-[10px] text-[#71717a] mono-text">CEP: {req.zipCode} | Impressora: {req.machineModel}</span>
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

                          return (
                            <div className="space-y-4 pt-2 border-t border-[#18181b]">
                              {/* Dados Dimensionais */}
                              <div className="bg-[#050506] p-4 rounded border border-[#18181b] space-y-3">
                                <span className="text-[9px] text-[#71717a] font-bold uppercase tracking-wider block mono-text">
                                  1. Calibração Dimensional (Cubo 20mm)
                                </span>
                                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                                  <div className="bg-[#09090b] border border-[#18181b] p-2 rounded">
                                    <span className="text-[#71717a] block">Eixo X</span>
                                    <strong className="text-white block mt-0.5">{req.calibX.toFixed(2)} mm</strong>
                                    <span className={`text-[8px] block mt-0.5 ${devX <= 0.05 ? "text-green-500" : "text-red-500"}`}>
                                      Δ: {req.calibX - 20 >= 0 ? `+${(req.calibX - 20).toFixed(2)}` : (req.calibX - 20).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="bg-[#09090b] border border-[#18181b] p-2 rounded">
                                    <span className="text-[#71717a] block">Eixo Y</span>
                                    <strong className="text-white block mt-0.5">{req.calibY.toFixed(2)} mm</strong>
                                    <span className={`text-[8px] block mt-0.5 ${devY <= 0.05 ? "text-green-500" : "text-red-500"}`}>
                                      Δ: {req.calibY - 20 >= 0 ? `+${(req.calibY - 20).toFixed(2)}` : (req.calibY - 20).toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="bg-[#09090b] border border-[#18181b] p-2 rounded">
                                    <span className="text-[#71717a] block">Eixo Z</span>
                                    <strong className="text-white block mt-0.5">{req.calibZ.toFixed(2)} mm</strong>
                                    <span className={`text-[8px] block mt-0.5 ${devZ <= 0.05 ? "text-green-500" : "text-red-500"}`}>
                                      Δ: {req.calibZ - 20 >= 0 ? `+${(req.calibZ - 20).toFixed(2)}` : (req.calibZ - 20).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center text-[10px] border-t border-[#18181b]/50 pt-2">
                                  <span className="text-[#71717a]">Desvio Máximo Encontrado:</span>
                                  <span className={`font-bold ${isWithinTolerance ? "text-green-500" : "text-red-500"}`}>
                                    {maxDeviation.toFixed(3)} mm ({isWithinTolerance ? "Dentro da Tolerância ±0.05mm" : "Fora da Tolerância"})
                                  </span>
                                </div>
                              </div>

                              {/* Documentos Anexados */}
                              <div className="bg-[#050506] p-4 rounded border border-[#18181b] space-y-3 text-[10px]">
                                <span className="text-[9px] text-[#71717a] font-bold uppercase tracking-wider block mono-text">
                                  2. Documentos e Comprovantes (KYC)
                                </span>
                                <div className="grid grid-cols-3 gap-2">
                                  <a 
                                    href="#" 
                                    onClick={(e) => { e.preventDefault(); alert(`Visualizando documento simulado: ${req.documentUrl}`); }}
                                    className="bg-[#09090b] hover:bg-[#18181b] border border-[#18181b] p-2 rounded text-center block text-[#a1a1aa] transition"
                                  >
                                    📄 RG/CNH
                                    <span className="text-[8px] text-[#71717a] block truncate mt-0.5">{req.documentUrl}</span>
                                  </a>
                                  <a 
                                    href="#" 
                                    onClick={(e) => { e.preventDefault(); alert(`Visualizando selfie simulada: ${req.selfieUrl}`); }}
                                    className="bg-[#09090b] hover:bg-[#18181b] border border-[#18181b] p-2 rounded text-center block text-[#a1a1aa] transition"
                                  >
                                    📸 Selfie KYC
                                    <span className="text-[8px] text-[#71717a] block truncate mt-0.5">{req.selfieUrl}</span>
                                  </a>
                                  <a 
                                    href="#" 
                                    onClick={(e) => { e.preventDefault(); alert(`Visualizando foto do paquímetro simulada: ${req.benchmarkImageUrl}`); }}
                                    className="bg-[#09090b] hover:bg-[#18181b] border border-[#18181b] p-2 rounded text-center block text-[#a1a1aa] transition"
                                  >
                                    📏 Paquímetro
                                    <span className="text-[8px] text-[#71717a] block truncate mt-0.5">{req.benchmarkImageUrl}</span>
                                  </a>
                                </div>
                              </div>

                              {/* Ações de Auditoria */}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => approveMakerRequest(req.id, req.name)}
                                  className="flex-grow py-2 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded uppercase tracking-wider transition cursor-pointer"
                                >
                                  ✅ Aprovar e Homologar
                                </button>
                                <button
                                  onClick={() => rejectMakerRequest(req.id, req.name)}
                                  className="px-4 py-2 border border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10 text-[10px] font-bold rounded uppercase tracking-wider transition cursor-pointer"
                                >
                                  ❌ Rejeitar
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
                <div className="technical-panel rounded overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#18181b] bg-[#09090b]">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text">Controle da Rede de Colaboradores</h3>
                  </div>

                  <div className="divide-y divide-[#18181b] text-xs">
                    {systemMakers.map((maker) => (
                      <div key={maker.name} className="p-4 flex justify-between items-center">
                        <div>
                          <span className="font-bold text-white block">{maker.name}</span>
                          <span className="text-[10px] text-[#71717a] mono-text">Reputação: ★ {maker.rating} | Penalidades: {maker.penalties}/3</span>
                        </div>
                        <button
                          onClick={() => toggleBanMaker(maker.name)}
                          className={`px-3 py-1 text-[10px] font-bold rounded uppercase tracking-wider border transition ${
                            maker.isBanned
                              ? "border-green-500/30 text-green-500 bg-green-500/5 hover:bg-green-500/10"
                              : "border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10"
                          }`}
                        >
                          {maker.isBanned ? "Desbanir" : "Banir Parceiro"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>

            {/* Seção ADM: Gerenciamento da Loja de Insumos (Dropshipping) */}
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
                      deliveryTime: novoInsumoDelivery || "3 a 7 dias úteis"
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
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mono-text">Cadastrar Novo Produto para Revenda / Dropshipping</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Nome do Produto</label>
                      <input 
                        type="text" value={novoInsumoTitle} onChange={(e) => setNovoInsumoTitle(e.target.value)} placeholder="Filamento PLA 1kg"
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Preço de Venda (R$)</label>
                      <input 
                        type="number" step="0.01" value={novoInsumoPrice} onChange={(e) => setNovoInsumoPrice(e.target.value)} placeholder="119.90"
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Link do Fornecedor (Shopee/Ali)</label>
                      <input 
                        type="text" value={novoInsumoLink} onChange={(e) => setNovoInsumoLink(e.target.value)} placeholder="https://shopee..."
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Comissão de Afiliado (%)</label>
                      <input 
                        type="number" value={novoInsumoCommission} onChange={(e) => setNovoInsumoCommission(e.target.value)} placeholder="5"
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">URL da Imagem</label>
                      <input 
                        type="text" value={novoInsumoImage} onChange={(e) => setNovoInsumoImage(e.target.value)} placeholder="https://images.unsplash..."
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Prazo de Entrega Estimado</label>
                      <input 
                        type="text" value={novoInsumoDelivery} onChange={(e) => setNovoInsumoDelivery(e.target.value)} placeholder="3 a 7 dias úteis"
                        className="w-full bg-[#09090b] border border-[#18181b] rounded p-2 text-white focus:outline-none focus:border-[#d44d00] transition"
                      />
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
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mono-text">Produtos Ativos na Loja</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    {lojaInsumos.map(prod => (
                      <div key={prod.id} className="border border-[#18181b] p-3 rounded bg-[#09090b] flex justify-between items-center">
                        <div>
                          <strong className="text-white block truncate max-w-[150px]">{prod.title}</strong>
                          <span className="text-[10px] text-[#71717a] mono-text">R$ {prod.price.toFixed(2)} | Prazo: {prod.deliveryTime}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setLojaInsumos(prev => prev.filter(p => p.id !== prod.id));
                            alert(`Produto "${prod.title}" removido da loja.`);
                          }}
                          className="text-[10px] text-red-500 hover:text-red-400 font-bold uppercase cursor-pointer"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER TÉCNICO - Minimalista */}
      <footer className="border-t border-[#18181b] py-12 bg-[#050506]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center">
              <Image 
                src={logoImg} 
                alt="FAB MAKERS" 
                className="h-14 w-auto select-none" 
              />
            </div>
            <p className="text-[11px] text-[#71717a] leading-relaxed">
              Manufatura digital distribuída sob demanda no Brasil. A maior infraestrutura descentralizada de ativos de impressão.
            </p>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mono-text mb-3">Plataforma</h4>
            <ul className="space-y-2 text-[11px] text-[#71717a]">
              <li><button onClick={() => { if (currentUser?.role === "CLIENT") setActiveTab("client"); else { setLoginRole("CLIENT"); setLoginEmail(""); setLoginPassword(""); setLoginError(""); setShowLoginModal(true); } }} className="hover:text-white transition cursor-pointer">Cotação STL</button></li>
              <li><button onClick={() => { if (currentUser?.role === "MAKER") setActiveTab("maker"); else { setLoginRole("MAKER"); setLoginEmail(""); setLoginPassword(""); setLoginError(""); setShowLoginModal(true); } }} className="hover:text-white transition cursor-pointer">Portal do Maker</button></li>
              <li><button onClick={() => { if (currentUser?.role === "ADMIN") setActiveTab("admin"); else { setLoginRole("ADMIN"); setLoginEmail(""); setLoginPassword(""); setLoginError(""); setShowLoginModal(true); } }} className="hover:text-white transition cursor-pointer">Administração</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mono-text mb-3">Políticas da Rede</h4>
            <ul className="space-y-2 text-[11px] text-[#71717a]">
              <li><span className="text-[#a1a1aa]">SLA de Resposta: Aceite em 30s</span></li>
              <li><span className="text-[#a1a1aa]">Desistência: Penalidade de Nível</span></li>
              <li><span className="text-[#a1a1aa]">Tolerância Dimensional: ±0.05mm</span></li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mono-text mb-3">Status do Grid</h4>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/20 rounded text-[9px] font-bold tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
              Grid Operacional: {systemMakers.filter(m => m.isApproved && !m.isBanned).length + 343} Online
            </div>
            <p className="text-[9px] text-[#71717a] mt-2 block">Latência média do Roteador: 85ms</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-12 pt-6 border-t border-[#18181b] flex flex-col sm:flex-row justify-between text-[10px] text-[#71717a] gap-4">
          <p>&copy; {new Date().getFullYear()} FAB MAKERS. Todos os direitos reservados. Projeto Conceitual e Confidencial.</p>
        </div>
      </footer>

      {/* MODAL DE LOGIN MODULAR E SEGURO */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050506]/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#09090b] border border-[#18181b] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header do Modal */}
            <div className="px-6 py-4 border-b border-[#18181b] flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mono-text">
                {loginRole === "ADMIN" ? "Gestão de Rede (Admin)" : loginRole === "MAKER" ? "Acesso do Fabricante (Maker)" : "Acesso do Cliente (STL)"}
              </h3>
              <button 
                onClick={() => setShowLoginModal(false)}
                className="text-[#71717a] hover:text-white transition text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleLogin} className="p-6 space-y-4">
              {loginError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs font-medium">
                  ⚠️ {loginError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] text-[#71717a] uppercase tracking-wider font-bold block">Endereço de E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="exemplo@seuprovedor.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-[#050506] border border-[#18181b] rounded px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#d44d00] transition"
                />
              </div>

              {loginRole !== "CLIENT" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] text-[#71717a] uppercase tracking-wider font-bold block">Senha de Acesso</label>
                    {loginRole === "ADMIN" && (
                      <span className="text-[9px] text-[#71717a] lowercase italic">dica: admin123</span>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-[#050506] border border-[#18181b] rounded px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#d44d00] transition"
                  />
                </div>
              )}

              {loginRole === "CLIENT" && (
                <p className="text-[10px] text-[#71717a] leading-relaxed italic">
                  * Para fins de testes e demonstração da cotação STL, se o e-mail digitado não existir, uma conta de cliente será criada automaticamente sem necessidade de senha.
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
                    Autenticando...
                  </>
                ) : (
                  "Acessar Plataforma"
                )}
              </button>
              
              <div className="pt-2 text-center">
                <span 
                  onClick={() => {
                    // Alterna o perfil dentro do próprio modal
                    setLoginRole(prev => prev === "CLIENT" ? "MAKER" : prev === "MAKER" ? "ADMIN" : "CLIENT");
                    setLoginEmail("");
                    setLoginPassword("");
                    setLoginError("");
                  }}
                  className="text-[10px] text-[#71717a] hover:text-white transition cursor-pointer underline"
                >
                  Alternar tipo de perfil de acesso
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}
