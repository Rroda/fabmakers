import { NextResponse } from "next/server";
import crypto from "crypto";

// Configurações da API da Shopee (em produção, devem ser configuradas nas variáveis de ambiente .env)
const SHOPEE_PARTNER_ID = process.env.SHOPEE_PARTNER_ID || "";
const SHOPEE_PARTNER_KEY = process.env.SHOPEE_PARTNER_KEY || "";
const SHOPEE_SHOP_ID = process.env.SHOPEE_SHOP_ID || "";
const SHOPEE_API_HOST = "https://partner.shopeemobile.com"; // Host de produção

/**
 * Função utilitária para gerar a assinatura HMAC-SHA256 exigida pela API da Shopee v2
 */
function generateShopeeSignature(path: string, timestamp: number, partnerId: string, partnerKey: string, shopId?: string): string {
  let baseStr = `${partnerId}${path}${timestamp}`;
  if (shopId) {
    baseStr += shopId;
  }
  return crypto.createHmac("sha256", partnerKey).update(baseStr).digest("hex");
}

/**
 * GET /api/dropshipping/shopee
 * Busca informações em tempo real de um item da Shopee usando a API Oficial
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("itemId");

  if (!itemId) {
    return NextResponse.json({ error: "itemId é obrigatório" }, { status: 400 });
  }

  // Se as chaves não estiverem configuradas, retorna dados simulados baseados na estrutura real da API da Shopee
  if (!SHOPEE_PARTNER_ID || !SHOPEE_PARTNER_KEY) {
    // Simulação inteligente simulando a resposta da Shopee API v2
    return NextResponse.json({
      success: true,
      source: "mock_api_fallback",
      shopee_item_id: itemId,
      title: itemId === "ins1" ? "Filamento PLA Premium 1kg - GTMax3D" : "Acessório 3D Homologado Shopee",
      current_price: itemId === "ins1" ? 119.90 : 89.90,
      original_price: itemId === "ins1" ? 149.00 : 110.00,
      stock: 45, // Estoque atualizado vindo da Shopee
      installment: {
        months: 6,
        amount: itemId === "ins1" ? 19.98 : 14.98,
        interest_free: true
      },
      shipping_fee: 12.50,
      estimated_delivery: "3 a 7 dias úteis",
      deep_link: `https://shopee.com.br/product-i.123456.${itemId}?utm_source=affiliate&utm_medium=fabmakers`
    });
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/product/get_item_base_info";
    const sign = generateShopeeSignature(path, timestamp, SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY, SHOPEE_SHOP_ID);

    const url = `${SHOPEE_API_HOST}${path}?partner_id=${SHOPEE_PARTNER_ID}&timestamp=${timestamp}&sign=${sign}&shop_id=${SHOPEE_SHOP_ID}&item_id_list=${itemId}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await res.json();

    if (data.error) {
      return NextResponse.json({ error: data.message || "Erro na API da Shopee" }, { status: 500 });
    }

    const item = data.response?.item_list?.[0];
    if (!item) {
      return NextResponse.json({ error: "Produto não encontrado na Shopee" }, { status: 404 });
    }

    // Calcula parcelamento simulado (regras padrão brasileiras de juros da Shopee)
    const price = item.price_info?.[0]?.current_price || 0;

    return NextResponse.json({
      success: true,
      source: "shopee_api_v2",
      shopee_item_id: item.item_id,
      title: item.item_name,
      current_price: price,
      stock: item.stock_info?.[0]?.normal_stock || 0,
      installment: {
        months: 6,
        amount: Number((price / 6).toFixed(2)),
        interest_free: true
      },
      estimated_delivery: "3 a 7 dias úteis",
      deep_link: `https://shopee.com.br/product-i.${SHOPEE_SHOP_ID}.${item.item_id}`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno de integração" }, { status: 500 });
  }
}

/**
 * POST /api/dropshipping/shopee
 * Webhook para receber notificações de alteração de preço ou estoque da Shopee (Push Notifications)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // A Shopee envia pushs para avisar quando um item cadastrado muda de preço ou estoque
    console.log("Recebido Webhook da Shopee:", body);
    
    // Aqui você pode rodar a atualização no banco Prisma para atualizar a loja de insumos automaticamente
    
    return NextResponse.json({ success: true, message: "Webhook recebido" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
