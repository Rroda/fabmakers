"use client";

import { useState, useRef, DragEvent, ChangeEvent, useEffect } from "react";
import Image from "next/image";
import logoImg from "../logo/logo.png";

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
  createdAt: string;
}

// Interface para impressoras cadastradas
interface Machine {
  id: string;
  brand: string;
  model: string;
  nozzle: string;
  volume: string;
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
  };
}

// Interface para solicitações de homologação na fila do Admin
interface HomologationRequest {
  id: string;
  name: string;
  zipCode: string;
  machineModel: string;
  benchmarkResult: "PENDING" | "APPROVED" | "REJECTED";
  benchmarkImageUrl: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"home" | "client" | "maker" | "admin">("home");

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
      machines: [{ id: "m1", brand: "Bambu Lab", model: "P1S", nozzle: "0.4mm", volume: "256x256x256mm" }],
      filaments: [{ id: "f1", type: "PLA", color: "Preto", weightG: 850 }],
      availability: { days: ["seg", "ter", "qua", "qui", "sex"], shifts: ["tarde", "noite"], months: ["todos"] }
    },
    {
      name: "Roberto Lima",
      zipCode: "01001-000",
      rating: 4.2,
      penalties: 1,
      isBanned: false,
      isApproved: true,
      machines: [{ id: "m2", brand: "Creality", model: "K1 Max", nozzle: "0.6mm", volume: "300x300x300mm" }],
      filaments: [{ id: "f2", type: "PETG", color: "Cinza", weightG: 600 }],
      availability: { days: ["seg", "qua", "sex", "sab"], shifts: ["manha", "tarde"], months: ["todos"] }
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
      benchmarkImageUrl: "cubo_teste_andre.jpg"
    },
    {
      id: "req-2",
      name: "Fernanda Dias",
      zipCode: "30110-000",
      machineModel: "Formlabs Form 4",
      benchmarkResult: "PENDING",
      benchmarkImageUrl: "peca_resina_fernanda.jpg"
    }
  ]);

  // Push notification simulado para o Maker (estilo Uber)
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

  // --- ESTADOS DE CADASTRO DO MAKER (WIZARD ETAPAS) ---
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardName, setWizardName] = useState<string>("");
  const [wizardZip, setWizardZip] = useState<string>("");
  const [wizardMachines, setWizardMachines] = useState<Machine[]>([
    { id: "1", brand: "Bambu Lab", model: "P1S", nozzle: "0.4mm", volume: "256x256x256mm" }
  ]);
  const [wizardFilaments, setWizardFilaments] = useState<Filament[]>([
    { id: "1", type: "PLA", color: "Preto", weightG: 1000 }
  ]);
  const [wizardDays, setWizardDays] = useState<string[]>(["seg", "ter", "qua", "qui", "sex"]);
  const [wizardShifts, setWizardShifts] = useState<string[]>(["tarde", "noite"]);

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

  // Simulação do Timer da Oferta UBER no Maker
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

  // Se um pedido entra em WAITING_MAKER, e temos um Maker logado e aprovado, dispara a oferta estilo Uber
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

  // Enviar ordem para fabricação local
  const dispatchOrder = () => {
    if (!quote) return;
    
    const newOrder: SimulatedOrder = {
      id: Math.floor(1000 + Math.random() * 9000).toString(),
      filename: quote.filename,
      status: "WAITING_MAKER",
      totalPrice: quote.pricing.totalPrice,
      weightG: quote.metrics.weightG,
      timeFormatted: quote.metrics.timeFormatted,
      progress: 0,
      material: material,
      zipCode: "13083-970",
      createdAt: new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };

    setOrders(prev => [newOrder, ...prev]);
    handleClear();
    alert(`Pedido #${newOrder.id} enviado para o roteador geolocalizado! Os makers nas proximidades receberão o Push.`);
  };

  // --- FUNÇÕES DO MAKER (WIZARD & UBER FLOW) ---
  
  // Concluir cadastro do Maker (Envia solicitação para aprovação do Admin)
  const handleRegisterMaker = () => {
    if (!wizardName || !wizardZip) {
      alert("Por favor, preencha o Nome e o CEP.");
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
        months: ["todos"]
      }
    };

    setMakerProfile(newProfile);

    // Enviar solicitação de homologação para o Admin
    const newRequest: HomologationRequest = {
      id: `req-${Math.floor(100 + Math.random() * 900)}`,
      name: wizardName,
      zipCode: wizardZip,
      machineModel: wizardMachines[0]?.model || "FDM Standard",
      benchmarkResult: "PENDING",
      benchmarkImageUrl: "cubo_calibracao_novo.jpg"
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
      volume: "180x180x180mm"
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

  // Aceitar Job (Uber Flow)
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

  // Rejeitar Job (Uber Flow)
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
      const updated = { ...makerProfile, isApproved: true };
      setMakerProfile(updated);
      setSystemMakers(prev => [...prev, updated]);
    } else {
      // Adiciona na lista geral de aprovados
      setSystemMakers(prev => 
        prev.map(m => m.name === name ? { ...m, isApproved: true } : m)
      );
    }
    alert(`Maker ${name} homologado com sucesso! Agora está habilitado para receber cotações do Grid.`);
  };

  // Banir / Desbanir Maker manualmente
  const toggleBanMaker = (name: string) => {
    setSystemMakers(prev => 
      prev.map(m => {
        if (m.name === name) {
          const nextBanned = !m.isBanned;
          if (makerProfile && makerProfile.name === name) {
            setMakerProfile({ ...makerProfile, isBanned: nextBanned });
          }
          return { ...m, isBanned: nextBanned, penalties: nextBanned ? 3 : 0, rating: nextBanned ? 3.0 : 5.0 };
        }
        return m;
      })
    );
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

  return (
    <div className="min-h-screen bg-[#050506] text-[#f4f4f5] flex flex-col font-sans selection:bg-[#d44d00]/30 selection:text-white">
      
      {/* HEADER TÉCNICO - Minimalista, com logo PNG calibrado */}
      <header className="border-b border-[#18181b] bg-[#050506] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <div 
              className="flex items-center cursor-pointer"
              onClick={() => setActiveTab("home")}
            >
              <Image 
                src={logoImg} 
                alt="FAB MAKERS" 
                className="h-16 w-auto select-none" 
                priority 
              />
            </div>

            {/* Abas do Next.js de Navegação Reativa */}
            <nav className="hidden md:flex items-center gap-1 bg-[#09090b] border border-[#18181b] p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("home")}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  activeTab === "home"
                    ? "bg-[#18181b] text-white"
                    : "text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/30"
                }`}
              >
                Início
              </button>
              <button
                onClick={() => setActiveTab("client")}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  activeTab === "client"
                    ? "bg-[#18181b] text-white"
                    : "text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/30"
                }`}
              >
                Painel Cliente
              </button>
              <button
                onClick={() => setActiveTab("maker")}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  activeTab === "maker"
                    ? "bg-[#18181b] text-white"
                    : "text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/30"
                }`}
              >
                Painel Maker (UBER)
              </button>
              <button
                onClick={() => setActiveTab("admin")}
                className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                  activeTab === "admin"
                    ? "bg-[#18181b] text-white"
                    : "text-[#a1a1aa] hover:text-white hover:bg-[#18181b]/30"
                }`}
              >
                Painel Admin
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("client")}
              className="text-xs bg-[#d44d00] hover:bg-[#b04000] text-white px-4 py-2 font-medium transition rounded-md"
            >
              Cote seu STL
            </button>
            <a
              href="/pitch_fabmakers.html"
              target="_blank"
              className="hidden sm:inline-block text-xs font-medium border border-[#18181b] text-[#a1a1aa] hover:text-white bg-[#09090b] hover:bg-[#18181b] px-4 py-2 transition rounded-md"
            >
              Apresentação & Pitch
            </a>
          </div>
        </div>
        
        {/* Navegação Mobile */}
        <div className="md:hidden flex justify-between border-t border-[#18181b] px-4 py-2 bg-[#09090b]">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex-1 text-center py-2 text-[11px] font-medium transition ${
              activeTab === "home" ? "text-[#d44d00]" : "text-[#71717a]"
            }`}
          >
            Início
          </button>
          <button
            onClick={() => setActiveTab("client")}
            className={`flex-1 text-center py-2 text-[11px] font-medium transition ${
              activeTab === "client" ? "text-[#d44d00]" : "text-[#71717a]"
            }`}
          >
            Cliente
          </button>
          <button
            onClick={() => setActiveTab("maker")}
            className={`flex-1 text-center py-2 text-[11px] font-medium transition ${
              activeTab === "maker" ? "text-[#d44d00]" : "text-[#71717a]"
            }`}
          >
            Maker
          </button>
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex-1 text-center py-2 text-[11px] font-medium transition ${
              activeTab === "admin" ? "text-[#d44d00]" : "text-[#71717a]"
            }`}
          >
            Admin
          </button>
        </div>
      </header>

      {/* CONTEÚDO DINÂMICO DE ABAS */}
      <main className="flex-grow">

        {/* TAB 1: HOME (APRESENTAÇÃO MINIMALISTA) */}
        {activeTab === "home" && (
          <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#09090b] border border-[#18181b] rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d44d00] animate-pulse"></span>
                <span className="text-[10px] mono-text uppercase tracking-widest text-[#a1a1aa]">Rede de Manufatura Local</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-none">
                Transformamos ideias em <span className="text-[#d44d00]">objetos</span>.
              </h1>
              
              <p className="text-[#a1a1aa] font-light text-lg leading-relaxed max-w-xl">
                Infraestrutura descentralizada de fabricação digital sob demanda no Brasil. Cote peças, gerencie impressoras ociosas e roteie ordens de produção geolocalizadas em tempo real.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => setActiveTab("client")}
                  className="px-6 py-3.5 bg-white text-[#050506] font-bold text-sm rounded transition hover:bg-[#e4e4e7] flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  Área do Cliente (STL)
                </button>
                <button
                  onClick={() => setActiveTab("maker")}
                  className="px-6 py-3.5 border border-[#18181b] text-white hover:bg-[#09090b] font-medium text-sm rounded transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  Área do Maker (Colaborador)
                </button>
              </div>

              <div className="pt-12 grid grid-cols-3 gap-6 border-t border-[#18181b]">
                <div>
                  <div className="text-xl font-bold text-white mono-text">0.12s</div>
                  <div className="text-[10px] uppercase tracking-widest text-[#71717a] mt-1">Cotação STL</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white mono-text">350+</div>
                  <div className="text-[10px] uppercase tracking-widest text-[#71717a] mt-1">Makers Ativos</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white mono-text">100%</div>
                  <div className="text-[10px] uppercase tracking-widest text-[#71717a] mt-1">Roteamento Geolocalizado</div>
                </div>
              </div>
            </div>

            {/* Wireframe interativo SVG */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="w-full max-w-[450px] aspect-square bg-[#09090b] border border-[#18181b] rounded p-6 relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:32px_32px] opacity-30"></div>
                <svg viewBox="0 0 200 200" className="w-64 h-64 z-10 text-white select-none">
                  <circle cx="100" cy="100" r="80" stroke="#18181b" strokeWidth="0.5" fill="none" />
                  <g className="origin-center animate-[spin_40s_linear_infinite]">
                    <path d="M 100,50 L 135,70 L 135,110 L 100,130 L 65,110 L 65,70 Z" fill="none" stroke="#71717a" strokeWidth="0.75" />
                    <circle cx="100" cy="50" r="3" fill="#050506" stroke="#d44d00" strokeWidth="1" />
                    <circle cx="135" cy="70" r="3" fill="#050506" stroke="#d44d00" strokeWidth="1" />
                    <circle cx="135" cy="110" r="3" fill="#050506" stroke="#d44d00" strokeWidth="1" />
                  </g>
                  <line x1="20" y1="100" x2="180" y2="100" stroke="#d44d00" strokeWidth="0.75" className="animate-[bounce_4s_ease-in-out_infinite]" />
                  <text x="102" y="96" fill="#d44d00" fontSize="6" className="mono-text tracking-widest animate-[bounce_4s_ease-in-out_infinite]">GRID ATIVO</text>
                </svg>
                <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[9px] mono-text text-[#71717a]">
                  <span>FAB: 345 ONLINE</span>
                  <span>CALIBRATION: ±0.05mm</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: PAINEL CLIENTE (STL + HISTÓRICO + MAPA RASTREAMENTO) */}
        {activeTab === "client" && (
          <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Lado Esquerdo: Fatiador STL */}
            <div className="lg:col-span-7 space-y-8">
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
                    <button onClick={handleSimulateExample} className="text-[9px] mono-text text-[#a1a1aa] hover:text-white bg-[#18181b] px-3 py-1.5 rounded border border-[#27272a] transition">
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
                        className={`p-2 border text-xs font-semibold transition rounded ${
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
                  </div>

                  <button
                    onClick={dispatchOrder}
                    className="w-full py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
                  >
                    Despachar para Fabricação Local (UBER Flow)
                  </button>
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
        )}

        {/* TAB 3: PAINEL MAKER (CADASTRO PASSO A PASSO + NOTIFICAÇÕES UBER + REPUTAÇÃO E BANIMENTO) */}
        {activeTab === "maker" && (
          <div className="max-w-7xl mx-auto px-6 py-12">
            
            {/* 1. SE O MAKER NÃO ESTÁ CADASTRADO: WIZARD DE CADASTRO DETALHADO */}
            {!makerProfile ? (
              <div className="max-w-3xl mx-auto space-y-8">
                <div className="border-b border-[#18181b] pb-4">
                  <h2 className="text-xl font-bold text-white uppercase tracking-tight mono-text">Formulário de Entrada - Maker Parceiro</h2>
                  <p className="text-xs text-[#a1a1aa] mt-1">Siga as 3 etapas para cadastrar suas impressoras, estoque e escala de disponibilidade.</p>
                </div>

                {/* Indicador de passos */}
                <div className="flex justify-between text-xs text-[#71717a] font-semibold uppercase tracking-wider mono-text">
                  <span className={wizardStep === 1 ? "text-[#d44d00]" : ""}>1. Dados e Máquinas</span>
                  <span className={wizardStep === 2 ? "text-[#d44d00]" : ""}>2. Insumos em Estoque</span>
                  <span className={wizardStep === 3 ? "text-[#d44d00]" : ""}>3. Escala Calendário</span>
                </div>

                <div className="technical-panel p-6 rounded-lg space-y-6">
                  {/* PASSO 1: DADOS E MÁQUINAS */}
                  {wizardStep === 1 && (
                    <div className="space-y-6">
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
                            type="text" value={wizardZip} onChange={(e) => setWizardZip(e.target.value)} placeholder="Ex: 13083-970" 
                            className="w-full bg-[#050506] border border-[#18181b] rounded p-2.5 text-xs text-white focus:border-[#d44d00] focus:outline-none transition" 
                          />
                        </div>
                      </div>

                      {/* Lista de Máquinas */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text">Suas Impressoras 3D</label>
                          <button onClick={addMachine} className="text-[10px] text-[#d44d00] hover:underline font-bold">+ Adicionar Máquina</button>
                        </div>
                        {wizardMachines.map((mach, index) => (
                          <div key={mach.id} className="border border-[#18181b] p-3 rounded grid grid-cols-4 gap-2 bg-[#050506]">
                            <input 
                              type="text" value={mach.brand} placeholder="Marca" 
                              onChange={(e) => {
                                const newM = [...wizardMachines];
                                newM[index].brand = e.target.value;
                                setWizardMachines(newM);
                              }}
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white" 
                            />
                            <input 
                              type="text" value={mach.model} placeholder="Modelo" 
                              onChange={(e) => {
                                const newM = [...wizardMachines];
                                newM[index].model = e.target.value;
                                setWizardMachines(newM);
                              }}
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white" 
                            />
                            <select 
                              value={mach.nozzle} 
                              onChange={(e) => {
                                const newM = [...wizardMachines];
                                newM[index].nozzle = e.target.value;
                                setWizardMachines(newM);
                              }}
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-[#a1a1aa]"
                            >
                              <option value="0.2mm">Bocal 0.2mm</option>
                              <option value="0.4mm">Bocal 0.4mm</option>
                              <option value="0.6mm">Bocal 0.6mm</option>
                              <option value="0.8mm">Bocal 0.8mm</option>
                            </select>
                            <input 
                              type="text" value={mach.volume} placeholder="Volume Útil" 
                              onChange={(e) => {
                                const newM = [...wizardMachines];
                                newM[index].volume = e.target.value;
                                setWizardMachines(newM);
                              }}
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white" 
                            />
                          </div>
                        ))}
                      </div>

                      <button onClick={() => setWizardStep(2)} className="w-full py-2.5 bg-white text-black font-bold text-xs uppercase tracking-wider rounded transition hover:bg-[#e4e4e7]">
                        Avançar para Insumos
                      </button>
                    </div>
                  )}

                  {/* PASSO 2: INSUMOS EM ESTOQUE */}
                  {wizardStep === 2 && (
                    <div className="space-y-6">
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
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-[#a1a1aa]"
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
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white" 
                            />
                            <input 
                              type="number" value={fil.weightG} placeholder="Peso em Gramas" 
                              onChange={(e) => {
                                const newF = [...wizardFilaments];
                                newF[index].weightG = parseInt(e.target.value) || 0;
                                setWizardFilaments(newF);
                              }}
                              className="bg-[#09090b] border border-[#18181b] rounded p-2 text-xs text-white" 
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-4">
                        <button onClick={() => setWizardStep(1)} className="flex-1 py-2.5 border border-[#18181b] text-white font-bold text-xs uppercase tracking-wider rounded transition">
                          Voltar
                        </button>
                        <button onClick={() => setWizardStep(3)} className="flex-1 py-2.5 bg-white text-black font-bold text-xs uppercase tracking-wider rounded transition">
                          Avançar para Calendário
                        </button>
                      </div>
                    </div>
                  )}

                  {/* PASSO 3: CALENDÁRIO DISPONIBILIDADE */}
                  {wizardStep === 3 && (
                    <div className="space-y-6">
                      
                      {/* Calendário interativo de escala */}
                      <div className="space-y-4">
                        <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Grade de Escala Semanal (Escolha seus turnos de Trabalho)</label>
                        
                        <div className="grid grid-cols-7 gap-2 text-center text-xs">
                          {["seg", "ter", "qua", "qui", "sex", "sab", "dom"].map((day) => (
                            <div key={day} className="space-y-2">
                              <span className="font-bold text-[#a1a1aa] uppercase tracking-widest text-[9px] mono-text">{day}</span>
                              <button 
                                onClick={() => toggleDay(day)}
                                className={`w-full py-2 border rounded font-semibold text-[10px] uppercase transition ${
                                  wizardDays.includes(day) ? "border-[#d44d00] bg-[#d44d00]/5 text-white" : "border-[#18181b] bg-[#050506] text-[#71717a]"
                                }`}
                              >
                                {wizardDays.includes(day) ? "Escalado" : "Folga"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Turno Diário Disponível</label>
                        <div className="grid grid-cols-3 gap-2">
                          {["manha", "tarde", "noite"].map((shift) => (
                            <button
                              key={shift}
                              onClick={() => toggleShift(shift)}
                              className={`py-3 border text-xs font-semibold rounded uppercase tracking-wider transition ${
                                wizardShifts.includes(shift) ? "border-[#d44d00] bg-[#d44d00]/5 text-white" : "border-[#18181b] bg-[#050506] text-[#71717a]"
                              }`}
                            >
                              {shift === "manha" ? "Manhã (08h - 12h)" : shift === "tarde" ? "Tarde (12h - 18h)" : "Noite (18h - 23h)"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <button onClick={() => setWizardStep(2)} className="flex-1 py-2.5 border border-[#18181b] text-white font-bold text-xs uppercase tracking-wider rounded transition">
                          Voltar
                        </button>
                        <button onClick={handleRegisterMaker} className="flex-1 py-2.5 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition">
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
                
                {/* Cabeçalho do Maker Cadastrado */}
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
                        makerProfile.isApproved ? "border-green-500/30 text-green-500 bg-green-500/5" :
                        "border-yellow-500/30 text-yellow-500 bg-yellow-500/5"
                      }`}>
                        {makerProfile.isBanned ? "BANIDO" : makerProfile.isApproved ? "HOMOLOGADO" : "Aguardando Homologação"}
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
                ) : (
                  // MAKER ATIVO E HOMOLOGADO
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* UBER JOB FLOW: NOTIFICAÇÃO PUSH DE TRABALHOS PRÓXIMOS */}
                    <div className="lg:col-span-8 space-y-6">
                      
                      {/* Uber Push Alerta */}
                      {activeJobOffer ? (
                        <div className="border-2 border-[#d44d00] bg-[#d44d00]/5 p-6 rounded space-y-4 animate-pulse relative overflow-hidden">
                          {/* Efeito de laser minimalista rodando */}
                          <div className="absolute top-0 left-0 w-full h-1 bg-[#d44d00]"></div>
                          
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[9px] uppercase tracking-widest text-[#d44d00] font-bold mono-text block">TRABALHO DISPONÍVEL PRÓXIMO CEP</span>
                              <h3 className="text-base font-bold text-white mono-text mt-1">{activeJobOffer.filename}</h3>
                              <p className="text-[11px] text-[#a1a1aa] mt-1">Material exigido: <span className="text-white font-bold">{activeJobOffer.material}</span> | Peso: {activeJobOffer.weightG}g</p>
                            </div>
                            
                            {/* Cronômetro estilo Uber */}
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
                              <span className="text-[9px] text-[#71717a] uppercase block">Seu Ganho Líquido</span>
                              <span className="font-bold text-[#10b981]">R$ {(activeJobOffer.totalPrice * 0.8).toFixed(2).replace(".", ",")}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-[#71717a] uppercase block">CEP do Cliente</span>
                              <span className="font-bold text-white">{activeJobOffer.zipCode}</span>
                            </div>
                          </div>

                          <div className="flex gap-4 pt-2">
                            <button
                              onClick={acceptJob}
                              className="flex-1 py-3 bg-[#d44d00] hover:bg-[#b04000] text-white font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer text-center"
                            >
                              Aceitar Job (UBER)
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
                        <div className="technical-panel p-10 rounded text-center space-y-3">
                          <div className="w-8 h-8 rounded-full border border-dashed border-[#71717a] flex items-center justify-center mx-auto animate-spin">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#d44d00]"></span>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider mono-text">Status: Buscando Ofertas de Produção...</h4>
                            <p className="text-[10px] text-[#71717a] mt-1 leading-relaxed">
                              {makerProfile.isApproved 
                                ? "Você está online na rede. Pedidos despachados por clientes próximos aparecerão aqui com 30s para aceitação."
                                : "Aguarde sua homologação de qualidade pelo Administrador para começar a receber ofertas de fabricação."}
                            </p>
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
                <span className="text-[9px] uppercase tracking-wider text-[#71717a] mono-text block">Comissão Plataforma (20%)</span>
                <span className="text-2xl font-bold text-[#d44d00] block mt-1 mono-text">R$ {(orders.filter(o => o.status !== "CANCELLED").reduce((acc, curr) => acc + curr.totalPrice, 0) * 0.2).toFixed(2).replace(".", ",")}</span>
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

                        {req.benchmarkResult === "PENDING" && (
                          <div className="bg-[#050506] p-3 rounded border border-[#18181b] flex justify-between items-center">
                            <span className="text-[9px] text-[#71717a] mono-text">Inspeção Tolerância (Benchmark ±0.05mm)</span>
                            <button
                              onClick={() => approveMakerRequest(req.id, req.name)}
                              className="px-3 py-1 bg-[#d44d00] hover:bg-[#b04000] text-white text-[10px] font-bold rounded uppercase tracking-wider transition"
                            >
                              Homologar Máquina
                            </button>
                          </div>
                        )}
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
              <li><button onClick={() => setActiveTab("client")} className="hover:text-white transition">Cotação STL</button></li>
              <li><button onClick={() => setActiveTab("maker")} className="hover:text-white transition">Fila de Makers</button></li>
              <li><button onClick={() => setActiveTab("admin")} className="hover:text-white transition">Administração</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider mono-text mb-3">Termos & Regras</h4>
            <ul className="space-y-2 text-[11px] text-[#71717a]">
              <li><span className="text-[#a1a1aa]">Regra UBER: Aceite em 30s</span></li>
              <li><span className="text-[#a1a1aa]">Desistência: Perda de Reputação</span></li>
              <li><span className="text-[#a1a1aa]">Tolerância Mínima: ±0.05mm</span></li>
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
      
    </div>
  );
}
