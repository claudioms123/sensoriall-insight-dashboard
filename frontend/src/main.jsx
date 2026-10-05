
import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import jsPDF from 'jspdf'

function App(){
  const [cidade, setCidade] = useState('Brasilia')
  const [endereco, setEndereco] = useState('')
  const [orcamento, setOrcamento] = useState(2000000)
  const [finalidade, setFinalidade] = useState('investir')
  const [latClick, setLatClick] = useState(-15.79)
  const [lngClick, setLngClick] = useState(-47.88)
  const [data, setData] = useState(null)
  const [aba, setAba] = useState('viabilidade')
  const [origem, setOrigem] = useState('')
  const [rotas, setRotas] = useState([])
  const [comercios, setComercios] = useState([])
  const mapSelectRef = useRef(null); const mapResultRef = useRef(null)
  const mapSelectInstance = useRef(null); const mapResultInstance = useRef(null); const markerSelect = useRef(null); const rotaAtual = useRef(null)

  useEffect(()=>{
    if(!mapSelectRef.current || mapSelectInstance.current) return
    mapSelectInstance.current = L.map(mapSelectRef.current).setView([-15.79,-47.88], 4)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapSelectInstance.current)
    mapSelectInstance.current.on('click', async (e)=>{
      setLatClick(e.latlng.lat); setLngClick(e.latlng.lng)
      if(markerSelect.current) mapSelectInstance.current.removeLayer(markerSelect.current)
      markerSelect.current = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapSelectInstance.current).bindPopup('Destino').openPopup()
      try{ const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${e.latlng.lat}&lon=${e.latlng.lng}&format=json`); const j = await r.json(); if(j.display_name) setEndereco(j.display_name) }catch{}
    })
  },[])

  useEffect(()=>{
    if((aba!=='mapa' && aba!=='rotas') || !data || !mapResultRef.current) return
    if(mapResultInstance.current) mapResultInstance.current.remove()
    mapResultInstance.current = L.map(mapResultRef.current).setView([latClick,lngClick], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapResultInstance.current)
    L.marker([latClick,lngClick]).addTo(mapResultInstance.current).bindPopup(cidade).openPopup()
  },[aba, data, latClick, lngClick])

  const analisar = ()=>{
    const cub = {MG:2280.12, SP:2450.50, SC:2350.80, RJ:2510.30, DF:2800.50, DEFAULT:2300}[cidade.toUpperCase()]||2300
    const ticket = cidade.toLowerCase().includes('brasilia')? 6800 : 5500
    const base = {
      cidade, cub:{valor:cub}, mercado:{ticket, lat_click:latClick, lng_click:lngClick},
      mais_rentavel:{faixa:'premium', dados:{margem_bruta:32}},
      faixas:{
        economico:{material:{nome:'Economico - Bloco Estrutural 14x19x39'}, custo_m2: Math.round(cub*1.2), preco_m2: ticket, margem_bruta:22, lucro: Math.round(orcamento*0.22), pacote_detalhado:['Porcelanato 60x60 sala/banheiro (1 dos 10 itens)','Pintura PVA 2 demaos','Louca Deca padrao','Porta semi-oca 80cm','Janela aluminio 1,20m']},
        standard:{material:{nome:'Standard - Convencional Tijolo 9x19x19'}, custo_m2: Math.round(cub*1.5), preco_m2: ticket*1.15, margem_bruta:28, lucro: Math.round(orcamento*0.28), pacote_detalhado:['Porcelanato 80x80 sala/cozinha','Revestimento 3D 1 parede','Granito preto cozinha','Iluminacao LED embutida','Paisagismo basico']},
        premium:{material:{nome:'Premium - Parede Concreto Forma Aluminio 25Mpa'}, custo_m2: Math.round(cub*1.9), preco_m2: ticket*1.35, margem_bruta:32, lucro: Math.round(orcamento*0.32), pacote_detalhado:['Porcelanato 90x90 polido','Marmoraria completa banheiros','Esquadria preta piso-teto','Automacao persiana + iluminacao','Churrasqueira gourmet']},
      }
    }
    setData(base); setAba('viabilidade')
  }

  const buscarComercios = async ()=>{
    setComercios([{nome:'Buscando comércios...', tipo:'OSM'}])
    try{
      const q = `[out:json];(node["shop"="supermarket"](around:3000,${latClick},${lngClick});node["amenity"="school"](around:3000,${latClick},${lngClick});node["amenity"="hospital"](around:3000,${latClick},${lngClick});node["amenity"="pharmacy"](around:3000,${latClick},${lngClick});node["shop"="mall"](around:3000,${latClick},${lngClick}););out 12;`
      const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)
      const j = await r.json()
      const lista = (j.elements||[]).slice(0,12).map(el=>({nome: el.tags.name||el.tags.shop||el.tags.amenity||'Comércio', tipo: el.tags.shop||el.tags.amenity||'com', lat: el.lat, lng: el.lon, dist: Math.round(Math.sqrt(Math.pow(el.lat-latClick,2)+Math.pow(el.lon-lngClick,2))*111*1000)}))
      setComercios(lista.length? lista : [{nome:'Região com poucos dados no OSM - área rural ou loteamento novo', tipo:'info'}])
    }catch{ setComercios([{nome:'Erro Overpass - tente de novo', tipo:'erro'}]) }
  }

  const calcularRota = async (laO, loO, laD, loD, nome='Rota')=>{
    try{
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${loO},${laO};${loD},${laD}?overview=full&geometries=geojson`)
      const j = await r.json()
      if(!j.routes?.[0]) throw new Error('Rota nao encontrada - tente lat,lng')
      const coords = j.routes[0].geometry.coordinates.map(c=>[c[1], c[0]])
      const dist = (j.routes[0].distance/1000).toFixed(1); const tempo = Math.round(j.routes[0].duration/60)
      const m = mapResultInstance.current || mapSelectInstance.current
      if(m){ if(rotaAtual.current) m.removeLayer(rotaAtual.current); rotaAtual.current = L.polyline(coords, {color:'#8a5cf5', weight:5}).addTo(m); m.fitBounds(rotaAtual.current.getBounds()) }
      setRotas(prev=> [{nome, dist, tempo}, ...prev].slice(0,8))
    }catch(e){ alert(e.message) }
  }

  const gerarPDF = ()=>{
    if(!data) return
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text(`Sensoriall - ${data.cidade}`, 10, 15)
    doc.setFontSize(10); doc.text(`Endereco: ${endereco}`, 10, 22)
    doc.text(`LatLng: ${latClick.toFixed(5)}, ${lngClick.toFixed(5)} | Finalidade: ${finalidade} | Orcamento R$ ${Number(orcamento).toLocaleString('pt-BR')}`, 10, 28)
    doc.text(`CUB R$ ${data.cub.valor} | Ticket R$ ${data.mercado.ticket}`, 10, 34)
    let y=44
    Object.entries(data.faixas).forEach(([k,v])=>{
      if(y>260){doc.addPage(); y=10}
      doc.setFontSize(11); doc.text(`${k.toUpperCase()} - ${v.material.nome} - Margem ${v.margem_bruta}% - Lucro R$${v.lucro.toLocaleString('pt-BR')}`,10,y); y+=6
      doc.setFontSize(9); doc.text(`Custo m2 R$${v.custo_m2} | Venda m2 R$${v.preco_m2}`,10,y); y+=5
      v.pacote_detalhado.forEach(it=>{ doc.text(`- ${it}`,12,y); y+=4; if(y>280){doc.addPage(); y=10} })
      y+=4
    })
    if(rotas.length){ doc.setFontSize(11); doc.text('ROTAS:',10,y); y+=6; rotas.forEach(r=>{ doc.setFontSize(9); doc.text(`${r.nome}: ${r.dist}km ${r.tempo}min`,10,y); y+=5 }) }
    doc.save(`Sensoriall_${cidade}_${finalidade}_${Date.now()}.pdf`)
  }

  return (
    <div style={{background:'#0a0a12', color:'#fff', minHeight:'100vh', padding:'15px', fontFamily:'Inter'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div><b style={{color:'#D4AF37', fontSize:'18px'}}>Sensoriall</b> <small style={{color:'#888', marginLeft:'8px'}}>Sem login - pronto pra vender</small></div>
        <button onClick={gerarPDF} style={{background:'#D4AF37', color:'#000', border:'none', padding:'8px 16px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer'}}>📄 Gerar PDF Dossiê</button>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginTop:'15px'}}>
        <div style={{background:'#151525', padding:'15px', borderRadius:'12px', border:'1px solid #222'}}>
          <b>1. Escolha terreno - clique no mapa</b>
          <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Cidade - ex: Uberlandia" style={{width:'100%', marginTop:'10px', padding:'10px', borderRadius:'8px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Endereço (auto quando clicar no mapa)" style={{width:'100%', marginTop:'8px', padding:'10px', borderRadius:'8px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <div style={{display:'flex', gap:'8px', marginTop:'8px'}}>
            <input type="number" value={orcamento} onChange={e=>setOrcamento(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'8px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
            <select value={finalidade} onChange={e=>setFinalidade(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'8px', background:'#000', color:'#fff', border:'1px solid #333'}}>
              <option value="investir">Investir</option><option value="revenda">Revenda</option><option value="morar">Morar</option><option value="aluguel">Aluguel / Renda</option><option value="comercial">Comercial / Galpão</option>
            </select>
          </div>
          <div style={{marginTop:'8px', fontSize:'11px', color:'#D4AF37'}}>📍 Clique: {latClick.toFixed(5)}, {lngClick.toFixed(5)}</div>
          <button onClick={analisar} style={{width:'100%', marginTop:'12px', background:'#8a5cf5', padding:'14px', borderRadius:'8px', border:'none', color:'#fff', fontWeight:'bold', cursor:'pointer', fontSize:'14px'}}>Analisar Viabilidade com Local do Mapa</button>
        </div>
        <div style={{background:'#151525', borderRadius:'12px', overflow:'hidden', border:'1px solid #222'}}>
          <div style={{padding:'8px', fontSize:'10px', color:'#888', background:'#000'}}>CLIQUE NO TERRENO QUE QUER ANALISAR</div>
          <div ref={mapSelectRef} style={{height:'360px'}}></div>
        </div>
      </div>

      {data && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginTop:'15px'}}>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'10px', borderLeft:'4px solid #D4AF37'}}><small style={{color:'#888'}}>CUB</small><br/><b style={{fontSize:'16px'}}>R${data.cub.valor}</b></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'10px', borderLeft:'4px solid #8a5cf5'}}><small style={{color:'#888'}}>TICKET MERCADO</small><br/><b style={{fontSize:'16px'}}>R${data.mercado.ticket}/m²</b></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'10px', borderLeft:'4px solid #00ff88'}}><small style={{color:'#888'}}>MAIS RENTÁVEL</small><br/><b style={{color:'#00ff88'}}>{data.mais_rentavel.faixa} {data.mais_rentavel.dados.margem_bruta}%</b></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'10px', borderLeft:'4px solid #fff', cursor:'pointer'}} onClick={gerarPDF}><small style={{color:'#888'}}>AÇÃO</small><br/><b style={{textDecoration:'underline'}}>Baixar PDF Dossiê</b></div>
          </div>

          <div style={{display:'flex', gap:'8px', marginTop:'15px', flexWrap:'wrap'}}>
            {['viabilidade','mapa','rotas','obras','marketing'].map(t=> <button key={t} onClick={()=>setAba(t)} style={{padding:'8px 18px', borderRadius:'8px', background: aba===t?'#8a5cf5':'#222', color:'#fff', border:'none', cursor:'pointer', fontWeight: aba===t?'bold':'normal', textTransform:'capitalize'}}>{t}</button>)}
          </div>

          {aba==='viabilidade' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'20px', borderRadius:'12px', border:'1px solid #222'}}>
              <b style={{fontSize:'16px'}}>Viabilidade - 3 Faixas com Pacote 10 Itens Detalhado</b>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginTop:'16px'}}>
                {Object.entries(data.faixas).map(([k,v])=>(
                  <div key={k} style={{background:'#0a0a12', padding:'16px', borderRadius:'10px', border: data.mais_rentavel.faixa===k?'2px solid #D4AF37':'1px solid #333'}}>
                    <b style={{color: data.mais_rentavel.faixa===k?'#D4AF37':'#fff', fontSize:'13px'}}>{v.material.nome}</b>
                    <div style={{marginTop:'10px', fontSize:'13px', lineHeight:'1.6'}}><div>Custo m²: <b>R${v.custo_m2}</b></div><div>Venda m²: <b>R${v.preco_m2}</b></div><div>Margem: <b style={{color:'#00ff88'}}>{v.margem_bruta}%</b></div><div>Lucro estimado: <b style={{color:'#D4AF37'}}>R${v.lucro.toLocaleString('pt-BR')}</b></div></div>
                    <div style={{marginTop:'14px', background:'#000', padding:'10px', borderRadius:'8px', border:'1px solid #222'}}>
                      <small style={{color:'#888', fontWeight:'bold'}}>PACOTE INCLUSO (5 dos 10 itens visíveis):</small>
                      {v.pacote_detalhado.map((it,i)=><div key={i} style={{fontSize:'11px', color:'#aaa', padding:'3px 0', borderBottom:'1px solid #111'}}>{i+1}. {it}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aba==='rotas' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'20px', borderRadius:'12px', border:'1px solid #222'}}>
              <b style={{fontSize:'16px'}}>Rotas & Comércios - Destino {latClick.toFixed(5)}, {lngClick.toFixed(5)}</b>
              <div style={{display:'flex', gap:'8px', marginTop:'14px', flexWrap:'wrap'}}>
                <input value={origem} onChange={e=>setOrigem(e.target.value)} placeholder="Origem: ex: Rodoviária Brasília ou lat,lng" style={{flex:1, minWidth:'260px', padding:'12px', borderRadius:'8px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
                <button onClick={()=>{ if(!origem) return alert('Digite origem'); if(origem.includes(',')){ const [la,lo]=origem.split(',').map(Number); if(!isNaN(la)) calcularRota(la,lo,latClick,lngClick,origem)} else { fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(origem)}&format=json&limit=1`).then(r=>r.json()).then(j=>{ if(j[0]) calcularRota(Number(j[0].lat), Number(j[0].lon), latClick, lngClick, j[0].display_name.slice(0,40)); else alert('Origem não encontrada') }) } }} style={{padding:'12px 20px', background:'#8a5cf5', border:'none', color:'#fff', borderRadius:'8px', fontWeight:'bold', cursor:'pointer'}}>Calcular Rota</button>
                <button onClick={()=> navigator.geolocation.getCurrentPosition(p=> calcularRota(p.coords.latitude, p.coords.longitude, latClick, lngClick, 'Meu GPS'), ()=>alert('Ative GPS'))} style={{padding:'12px', background:'#222', border:'none', color:'#fff', borderRadius:'8px', cursor:'pointer'}}>📍 Meu GPS</button>
                <button onClick={buscarComercios} style={{padding:'12px 18px', background:'#D4AF37', border:'none', color:'#000', borderRadius:'8px', fontWeight:'bold', cursor:'pointer'}}>🏪 Buscar Comércios 3km</button>
              </div>
              {rotas.length>0 && <div style={{marginTop:'14px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px'}}>{rotas.map((r,i)=><div key={i} style={{background:'#0a0a12', padding:'12px', borderRadius:'8px', border:'1px solid #333'}}><b style={{fontSize:'12px'}}>{r.nome}</b><br/><small style={{color:'#00ff88'}}>{r.dist} km - {r.tempo} min de carro</small></div>)}</div>}
              <div style={{marginTop:'18px'}}><b style={{color:'#D4AF37'}}>Comércios Próximos (Overpass OSM 3km)</b><div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginTop:'10px'}}>{comercios.map((c,i)=><div key={i} style={{background:'#000', padding:'12px', borderRadius:'8px', border:'1px solid #222'}}><b style={{fontSize:'12px'}}>{c.nome}</b><br/><small style={{color:'#888'}}>{c.tipo} {c.dist?`- ${c.dist}m`:''}</small><br/>{c.lat && <button onClick={()=>calcularRota(c.lat,c.lng,latClick,lngClick,c.nome)} style={{marginTop:'8px', padding:'6px 10px', fontSize:'11px', background:'#222', color:'#fff', border:'none', borderRadius:'6px', cursor:'pointer'}}>Ver rota até aqui</button>}</div>)}</div></div>
              <div ref={mapResultRef} style={{height:'460px', marginTop:'18px', borderRadius:'10px', overflow:'hidden', border:'1px solid #333'}}></div>
            </div>
          )}

          {aba==='obras' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'20px', borderRadius:'12px', border:'1px solid #222'}}>
              <b style={{fontSize:'16px'}}>Tipos de Obra & Fundação - Definição Técnica por Pavimento</b>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginTop:'16px'}}>
                <div style={{background:'#0a0a12', padding:'14px', borderRadius:'10px', border:'1px solid #333'}}><b style={{color:'#D4AF37'}}>1. Convencional - Tijolo Cerâmico 9x19x19</b><br/><small style={{color:'#aaa', lineHeight:'1.5'}}>Mão de obra mais barata e flexível. Ideal térrea personalizada até 120m². Custo base CUB. Vantagem: acústica melhor deitado. Desvantagem: mais lento.</small><div style={{marginTop:'8px', background:'#000', padding:'8px', borderRadius:'6px', fontSize:'10px', color:'#888'}}>Custo: CUB x1.2 | 90 dias térrea</div></div>
                <div style={{background:'#0a0a12', padding:'14px', borderRadius:'10px', border:'1px solid #333'}}><b style={{color:'#D4AF37'}}>2. Estrutural - Bloco Concreto 14x19x39</b><br/><small style={{color:'#aaa', lineHeight:'1.5'}}>30% mais rápido, sem pilares/vigas. Ideal casas em série 2-3 pisos loteamento. Custo -8% vs convencional. Graute a cada 2m + 4 ferros 10mm cantos.</small><div style={{marginTop:'8px', background:'#000', padding:'8px', borderRadius:'6px', fontSize:'10px', color:'#888'}}>Custo: CUB x1.0 | 60 dias | Melhor CxB</div></div>
                <div style={{background:'#0a0a12', padding:'14px', borderRadius:'10px', border:'1px solid #333'}}><b style={{color:'#D4AF37'}}>3. Parede Concreto - Forma Alumínio 25Mpa</b><br/><small style={{color:'#aaa', lineHeight:'1.5'}}>1 casa/dia, zero infiltração, parede 10cm. Ideal 50+ casas 3 pisos. Custo -12% em escala. Concreto com impermeabilizante + fibra.</small><div style={{marginTop:'8px', background:'#000', padding:'8px', borderRadius:'6px', fontSize:'10px', color:'#888'}}>Custo: CUB x0.9 | 1 dia/pav | Escala</div></div>
              </div>
              <div style={{marginTop:'18px', background:'#000', padding:'16px', borderRadius:'10px', border:'1px solid #222'}}>
                <b style={{color:'#00ff88', fontSize:'14px'}}>Fundação por Tipo - O que usar sem erro</b>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginTop:'12px', fontSize:'12px', lineHeight:'1.6'}}>
                  <div style={{background:'#0a0a12', padding:'12px', borderRadius:'8px'}}><b style={{color:'#fff'}}>Térrea 70-120m²</b><br/>Sapata corrida 50x60cm + baldrame 15x40 20Mpa 4x8mm. OU Radier 12cm Q138 + lona 200micras + 5cm brita.<br/><b style={{color:'#D4AF37'}}>Custo: R$90-130/m²</b></div>
                  <div style={{background:'#0a0a12', padding:'12px', borderRadius:'8px'}}><b style={{color:'#fff'}}>2 Pisos 150-200m²</b><br/>Sapata isolada 80x80x50 + broca Ø25 6m até moledo + baldrame 15x50 4x10mm estribo 5mm/15cm. SPT opcional.<br/><b style={{color:'#D4AF37'}}>Custo: R$140-180/m²</b></div>
                  <div style={{background:'#0a0a12', padding:'12px', borderRadius:'8px', border:'1px solid #ff4444'}}><b style={{color:'#fff'}}>3 Pisos 200-300m² - EXIGE SPT</b><br/>Estaca escavada Ø30 8-12m + bloco 60x60x50 + viga baldrame 20x50 5x12,5mm. SPT R$800 Brasília/Uberlândia. SEM SPT NÃO FAZ.<br/><b style={{color:'#ff4444'}}>Custo: R$200-280/m²</b></div>
                </div>
              </div>
              <div style={{marginTop:'18px', background:'#1a1a2e', padding:'16px', borderRadius:'10px', borderLeft:'4px solid #00ff88'}}>
                <b style={{color:'#00ff88'}}>🛡️ Impermeabilização Anti-Umidade Solo (Ouro = nunca infiltra)</b><br/>
                <div style={{marginTop:'10px', fontSize:'12px', color:'#ccc', lineHeight:'1.8'}}>
                1. Baldrame: emulsão asfáltica 2 demãos + manta asfáltica 3mm até 30cm acima do solo - R$18/m linear<br/>
                2. 3 primeiras fiadas: argamassa com Vedacit 1:100 + pintura asfáltica antes do chapisco<br/>
                3. Radier: lona 200 micras + 5cm brita 1 + manta PEAD - impede umidade ascendente<br/>
                4. OURO: Bloco estrutural de concreto até 60cm altura + Xypex cristalizante na argamassa - impermeabilização definitiva<br/>
                5. Dreno: tubo corrugado 100mm com brita e bidim ao redor da obra - leva água pra longe<br/>
                <b style={{color:'#D4AF37'}}>Custo impermeabilização completa: R$22-35/m² - paga 1x e nunca mais volta na obra.</b>
                </div>
              </div>
            </div>
          )}

          {aba==='marketing' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'20px', borderRadius:'12px', border:'1px solid #222'}}>
              <b>Marketing - 1 dos 10 itens para cada faixa</b>
              <div style={{marginTop:'10px', fontSize:'12px', color:'#aaa', lineHeight:'1.8'}}>
                Econômico: Porcelanato 60x60 apenas sala/banheiro - resto cerâmica - economiza R$4.200<br/>
                Standard: Porcelanato 80x80 sala/cozinha + revestimento 3D 1 parede - valoriza foto<br/>
                Premium: Porcelanato 90x90 polido + marmoraria completa + esquadria preta - ticket +35%
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
