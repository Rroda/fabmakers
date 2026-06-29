/**
 * Utilitário matemático para análise e parsing de arquivos STL (Standard Triangle Language)
 * Suporta formatos ASCII e Binário.
 * Calcula o volume tridimensional em mm³ e as dimensões da caixa delimitadora (Bounding Box).
 */

export interface STLAnalysisResult {
  volume: number;          // em mm³
  trianglesCount: number;  // número total de faces
  boundingBox: {
    width: number;         // X dimensão em mm
    depth: number;         // Y dimensão em mm
    height: number;        // Z dimensão em mm
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
}

/**
 * Analisa o buffer de um arquivo STL e retorna o volume e dimensões
 */
export function analyzeSTL(buffer: Buffer): STLAnalysisResult {
  if (buffer.length < 84) {
    throw new Error("Arquivo STL inválido ou corrompido (muito pequeno).");
  }

  // Verifica se o arquivo é binário
  const isBinary = checkIsBinary(buffer);

  if (isBinary) {
    return parseBinarySTL(buffer);
  } else {
    return parseAsciiSTL(buffer);
  }
}

/**
 * Um arquivo STL binário tem exatamente:
 * - 80 bytes de cabeçalho (header)
 * - 4 bytes contendo o número de triângulos (uint32)
 * - N triângulos de 50 bytes cada
 * Tamanho total = 80 + 4 + N * 50
 */
function checkIsBinary(buffer: Buffer): boolean {
  const headerSize = 80;
  const numFacesSize = 4;
  const faceSize = 50;

  if (buffer.length < headerSize + numFacesSize) {
    return false;
  }

  const numFaces = buffer.readUInt32LE(headerSize);
  const expectedSize = headerSize + numFacesSize + numFaces * faceSize;

  return buffer.length === expectedSize;
}

/**
 * Realiza o parsing de arquivos STL no formato Binário
 */
function parseBinarySTL(buffer: Buffer): STLAnalysisResult {
  const numFaces = buffer.readUInt32LE(80);
  let totalVolume = 0;

  // Variáveis para calcular a Bounding Box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  let offset = 84;
  const faceSize = 50;

  for (let i = 0; i < numFaces; i++) {
    if (offset + faceSize > buffer.length) {
      break; // Proteção contra estouro de buffer
    }

    // Cada face possui:
    // - Normal vetor: 3 * float32 (12 bytes)
    // - Vértice 1: 3 * float32 (12 bytes)
    // - Vértice 2: 3 * float32 (12 bytes)
    // - Vértice 3: 3 * float32 (12 bytes)
    // - Atributo: uint16 (2 bytes)

    // Lemos os vértices (pulando a normal de 12 bytes)
    const v1x = buffer.readFloatLE(offset + 12);
    const v1y = buffer.readFloatLE(offset + 16);
    const v1z = buffer.readFloatLE(offset + 20);

    const v2x = buffer.readFloatLE(offset + 24);
    const v2y = buffer.readFloatLE(offset + 28);
    const v2z = buffer.readFloatLE(offset + 32);

    const v3x = buffer.readFloatLE(offset + 36);
    const v3y = buffer.readFloatLE(offset + 40);
    const v3z = buffer.readFloatLE(offset + 44);

    // Atualiza a Bounding Box
    const xs = [v1x, v2x, v3x];
    const ys = [v1y, v2y, v3y];
    const zs = [v1z, v2z, v3z];

    for (let j = 0; j < 3; j++) {
      if (xs[j] < minX) minX = xs[j];
      if (xs[j] > maxX) maxX = xs[j];
      if (ys[j] < minY) minY = ys[j];
      if (ys[j] > maxY) maxY = ys[j];
      if (zs[j] < minZ) minZ = zs[j];
      if (zs[j] > maxZ) maxZ = zs[j];
    }

    // Calcula o volume assinado do tetraedro formado por v1, v2, v3 e a origem (0,0,0)
    // Fórmula do determinante da matriz formada pelos três vetores
    const signedVolume = (
      -v3x * v2y * v1z +
       v2x * v3y * v1z +
       v3x * v1y * v2z -
       v1x * v3y * v2z -
       v2x * v1y * v3z +
       v1x * v2y * v3z
    ) / 6.0;

    totalVolume += signedVolume;

    offset += faceSize;
  }

  return {
    volume: Math.abs(totalVolume),
    trianglesCount: numFaces,
    boundingBox: {
      width: minX === Infinity ? 0 : Math.round((maxX - minX) * 10) / 10,
      depth: minY === Infinity ? 0 : Math.round((maxY - minY) * 10) / 10,
      height: minZ === Infinity ? 0 : Math.round((maxZ - minZ) * 10) / 10,
      minX, maxX, minY, maxY, minZ, maxZ
    }
  };
}

/**
 * Realiza o parsing de arquivos STL no formato ASCII
 */
function parseAsciiSTL(buffer: Buffer): STLAnalysisResult {
  const text = buffer.toString("utf8");
  let totalVolume = 0;
  let trianglesCount = 0;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  // Regex para capturar os triângulos no formato ASCII
  // facet normal ... outer loop vertex v1 vertex v2 vertex v3 endloop endfacet
  const vertexRegex = /vertex\s+(-?\d+\.?\d*[eE]?-?\d*)\s+(-?\d+\.?\d*[eE]?-?\d*)\s+(-?\d+\.?\d*[eE]?-?\d*)/g;
  
  const vertices: { x: number; y: number; z: number }[] = [];
  let match;

  while ((match = vertexRegex.exec(text)) !== null) {
    const x = parseFloat(match[1]);
    const y = parseFloat(match[2]);
    const z = parseFloat(match[3]);

    vertices.push({ x, y, z });

    // A cada 3 vértices, temos um triângulo completo
    if (vertices.length === 3) {
      const v1 = vertices[0];
      const v2 = vertices[1];
      const v3 = vertices[2];

      // Atualiza Bounding Box
      const xs = [v1.x, v2.x, v3.x];
      const ys = [v1.y, v2.y, v3.y];
      const zs = [v1.z, v2.z, v3.z];

      for (let j = 0; j < 3; j++) {
        if (xs[j] < minX) minX = xs[j];
        if (xs[j] > maxX) maxX = xs[j];
        if (ys[j] < minY) minY = ys[j];
        if (ys[j] > maxY) maxY = ys[j];
        if (zs[j] < minZ) minZ = zs[j];
        if (zs[j] > maxZ) maxZ = zs[j];
      }

      // Calcula o volume assinado
      const signedVolume = (
        -v3.x * v2.y * v1.z +
         v2.x * v3.y * v1.z +
         v3.x * v1.y * v2.z -
         v1.x * v3.y * v2.z -
         v2.x * v1.y * v3.z +
         v1.x * v2.y * v3.z
      ) / 6.0;

      totalVolume += signedVolume;
      trianglesCount++;

      // Limpa para a próxima face
      vertices.length = 0;
    }
  }

  return {
    volume: Math.abs(totalVolume),
    trianglesCount,
    boundingBox: {
      width: minX === Infinity ? 0 : Math.round((maxX - minX) * 10) / 10,
      depth: minY === Infinity ? 0 : Math.round((maxY - minY) * 10) / 10,
      height: minZ === Infinity ? 0 : Math.round((maxZ - minZ) * 10) / 10,
      minX, maxX, minY, maxY, minZ, maxZ
    }
  };
}
