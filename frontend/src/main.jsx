import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import jsPDF from 'jspdf'

function App(){
  const [email] = useState('claudioms123@gmail.com')
  const [cidade, setCidade] = useState('Brasília')
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
        economico:{material:{nome:'Econômico - Bloco Estrutural'}, custo_m2: Math.round(cub*1.2), preco_m2: ticket, margem_bruta:22, lucro: Math.round(orcamento*0.22), pacote_detalhado:['Porcelanato 60x60 apenas sala/banheiro (1 dos 10 itens)','Pintura PVA','Louça Deca padrão','Porta semi-oca','Janela alumínio']},
        standard:{material:{nome:'Standard - Convencional Tijolo'}, custo_m2: Math.round(cub*1.5), preco_m2: ticket*1.15, margem_bruta:28, lucro: Math.round(orcamento*0.28), pacote_detalhado:['Porcelanato 80x80 sala/cozinha','Revestimento 3D','Granito preto','Iluminação LED','Paisagismo']},
        premium:{material:{nome:'Premium - Parede Concreto'}, custo_m2: Math.round(cub*1.9), preco_m2: ticket*1.35, margem_bruta:32, lucro: Math.round(orcamento*0.32), pacote_detalhado:['Porcelanato 90x90 polido','Marmoraria completa','Esquadria preta','Automação','Churrasqueira']}
      }
    }
    setData(base); setAba('viabilidade')
  }

  const buscarComercios = async ()=>{
    setComercios([{nome:'Buscando...', tipo:'...'}])
    try{
      const q = `[out:json];(node["shop"="supermarket"](around:3000,${latClick},${lngClick});node["amenity"="school"](around:3000,${latClick},${lngClick});node["amenity"="hospital"](around:3000,${latClick},${lngClick});node["amenity"="pharmacy"](around:3000,${latClick},${lngClick});node["shop"="mall"](around:3000,${latClick},${lngClick}););out 12;`
      const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`)
      const j = await r.json()
      const lista = (j.elements||[]).slice(0,10).map(el=>({nome: el.tags.name||el.tags.shop||el.tags.amenity||'Comércio', tipo: el.tags.shop||el.tags.amenity||'com', lat: el.lat, lng: el.lon, dist: Math.round(Math.sqrt(Math.pow(el.lat-latClick,2)+Math.pow(el.lon-lngClick,2))*111*1000)}))
      setComercios(lista.length? lista : [{nome:'Poucos comércios cadastrados no OSM aqui', tipo:'rural'}])
    }catch{ setComercios([{nome:'Erro Overpass', tipo:'erro'}]) }
  }

  const calcularRota = async (laO, loO, laD, loD, nome='Rota')=>{
    try{
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${loO},${laO};${loD},${laD}?overview=full&geometries=geojson`)
      const j = await r.json()
      if(!j.routes?.[0]) throw new Error('Rota não encontrada')
      const coords = j.routes[0].geometry.coordinates.map(c=>[c[1], c[0]])
      const dist = (j.routes[0].distance/1000).toFixed(1); const tempo = Math.round(j.routes[0].duration/60)
      const m = mapResultInstance.current || mapSelectInstance.current
      if(m){ if(rotaAtual.current) m.removeLayer(rotaAtual.current); rotaAtual.current = L.polyline(coords, {color:'#8a5cf5', weight:5}).addTo(m); m.fitBounds(rotaAtual.current.getBounds()) }
      setRotas(prev=> [{nome, dist, tempo}, ...prev].slice(0,6))
    }catch(e){ alert(e.message) }
  }

  const gerarPDF = ()=>{
    if(!data) return
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text(`Sensoriall - ${data.cidade}`, 10, 15)
    doc.setFontSize(10); doc.text(`Endereco: ${endereco} | Finalidade: ${finalidade} | ${latClick.toFixed(5)}, ${lngClick.toFixed(5)}`, 10, 22)
    doc.text(`Orcamento R$ ${Number(orcamento).toLocaleString('pt-BR')} | CUB R$ ${data.cub.valor} | Ticket R$ ${data.mercado.ticket}`, 10, 28)
    let y=38
    Object.entries(data.faixas).forEach(([k,v])=>{ doc.setFontSize(11); doc.text(`${k.toUpperCase()} ${v.material.nome} Margem ${v.margem_bruta}% Lucro R$${v.lucro.toLocaleString('pt-BR')}`,10,y); y+=6; v.pacote_detalhado.forEach(it=>{ doc.setFontSize(9); doc.text(`- ${it}`,12,y); y+=4 }); y+=4; if(y>270){doc.addPage(); y=10} })
    rotas.forEach(r=>{ doc.text(`${r.nome}: ${r.dist}km ${r.tempo}min`,10,y); y+=5 })
    doc.save(`Sensoriall_${cidade}_${finalidade}.pdf`)
  }

  return (
    <div style={{background:'#0a0a12', color:'#fff', minHeight:'100vh', padding:'15px', fontFamily:'Inter'}}>
      <div style={{display:'flex', justifyContent:'space-between'}}><small style={{color:'#888'}}>Logado {email} (modo offline - sem backend) | Backend dormindo, usando dados locais</small><button onClick={gerarPDF} style={{background:'#D4AF37', color:'#000', border:'none', padding:'6px 12px', borderRadius:'6px', fontWeight:'bold', cursor:'pointer'}}>📄 Gerar PDF</button></div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginTop:'10px'}}>
        <div style={{background:'#151525', padding:'15px', borderRadius:'12px'}}>
          <b>1. Busca + Clique no mapa (funciona sem backend)</b>
          <input value={cidade} onChange={e=>setCidade(e.target.value)} style={{width:'100%', marginTop:'10px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Endereço auto" style={{width:'100%', marginTop:'8px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <div style={{display:'flex', gap:'8px', marginTop:'8px'}}>
            <input type="number" value={orcamento} onChange={e=>setOrcamento(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
            <select value={finalidade} onChange={e=>setFinalidade(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}>
              <option value="investir">Investir</option><option value="revenda">Revenda</option><option value="morar">Morar</option><option value="aluguel">Aluguel / Renda</option><option value="comercial">Comercial / Galpão</option>
            </select>
          </div>
          <div style={{marginTop:'8px', fontSize:'11px', color:'#D4AF37'}}>📍 {latClick.toFixed(5)}, {lngClick.toFixed(5)}</div>
          <button onClick={analisar} style={{width:'100%', marginTop:'12px', background:'#8a5cf5', padding:'12px', borderRadius:'8px', border:'none', color:'#fff', fontWeight:'bold', cursor:'pointer'}}>Analisar com Local do Mapa (offline)</button>
        </div>
        <div style={{background:'#151525', borderRadius:'12px', overflow:'hidden'}}><div style={{padding:'8px', fontSize:'10px', color:'#888'}}>CLIQUE PARA DESTINO</div><div ref={mapSelectRef} style={{height:'300px'}}></div></div>
      </div>

      {data && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginTop:'15px'}}>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #D4AF37'}}><small>CUB</small><br/><b>R${data.cub.valor}</b></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #8a5cf5'}}><small>TICKET</small><br/><b>R${data.mercado.ticket}</b></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #00ff88'}}><small>MAIS RENTAVEL</small><br/><b>{data.mais_rentavel.faixa} {data.mais_rentavel.dados.margem_bruta}%</b></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px'}}><small>PDF</small><br/><b onClick={gerarPDF} style={{cursor:'pointer', textDecoration:'underline'}}>Gerar Dossiê</b></div>
          </div>

          <div style={{display:'flex', gap:'8px', marginTop:'15px', flexWrap:'wrap'}}>
            {['viabilidade','mapa','rotas','obras','marketing'].map(t=> <button key={t} onClick={()=>setAba(t)} style={{padding:'6px 14px', borderRadius:'6px', background: aba===t?'#8a5cf5':'#222', color:'#fff', border:'none', cursor:'pointer'}}>{t}</button>)}
          </div>

          {aba==='viabilidade' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}>
              <b>Viabilidade - 3 Faixas + PACOTE 10 ITENS</b>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'12px'}}>
                {Object.entries(data.faixas).map(([k,v])=>(
                  <div key={k} style={{background:'#0a0a12', padding:'15px', borderRadius:'8px', border: data.mais_rentavel.faixa===k?'2px solid #D4AF37':'1px solid #333'}}>
                    <b style={{color: data.mais_rentavel.faixa===k?'#D4AF37':'#fff'}}>{v.material.nome}</b>
                    <div style={{marginTop:'8px', fontSize:'12px'}}><div>Custo m² R${v.custo_m2}</div><div>Venda m² R${v.preco_m2}</div><div>Margem {v.margem_bruta}%</div><div>Lucro R${v.lucro.toLocaleString('pt-BR')}</div></div>
                    <div style={{marginTop:'10px', background:'#000', padding:'8px', borderRadius:'6px'}}>{v.pacote_detalhado.map((it,i)=><div key={i} style={{fontSize:'10px', color:'#aaa', padding:'2px 0'}}>{it}</div>)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aba==='rotas' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}>
              <b>Rotas - Destino {latClick.toFixed(5)}, {lngClick.toFixed(5)}</b>
              <div style={{display:'flex', gap:'8px', marginTop:'10px', flexWrap:'wrap'}}>
                <input value={origem} onChange={e=>setOrigem(e.target.value)} placeholder="Origem: Rodoviária ou lat,lng" style={{flex:1, minWidth:'200px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
                <button onClick={()=>{ if(!origem) return; if(origem.includes(',')){ const [la,lo]=origem.split(',').map(Number); calcularRota(la,lo,latClick,lngClick,origem)} else { fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(origem)}&format=json&limit=1`).then(r=>r.json()).then(j=>{ if(j[0]) calcularRota(Number(j[0].lat), Number(j[0].lon), latClick, lngClick, j[0].display_name.slice(0,40)) }) } }} style={{padding:'10px 16px', background:'#8a5cf5', border:'none', color:'#fff', borderRadius:'6px'}}>Calcular Rota Manual</button>
                <button onClick={()=> navigator.geolocation.getCurrentPosition(p=> calcularRota(p.coords.latitude, p.coords.longitude, latClick, lngClick, 'Meu GPS'))} style={{padding:'10px 12px', background:'#222', border:'none', color:'#fff', borderRadius:'6px'}}>📍 Meu GPS</button>
                <button onClick={buscarComercios} style={{padding:'10px 12px', background:'#D4AF37', border:'none', color:'#000', borderRadius:'6px', fontWeight:'bold'}}>Buscar Comércios 3km</button>
              </div>
              {rotas.length>0 && <div style={{marginTop:'12px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px'}}>{rotas.map((r,i)=><div key={i} style={{background:'#0a0a12', padding:'10px', borderRadius:'6px', border:'1px solid #333'}}><b style={{fontSize:'11px'}}>{r.nome}</b><br/><small>{r.dist} km - {r.tempo} min</small></div>)}</div>}
              <div style={{marginTop:'15px'}}><b style={{color:'#D4AF37'}}>Comércios Próximos</b><div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginTop:'8px'}}>{comercios.map((c,i)=><div key={i} style={{background:'#000', padding:'10px', borderRadius:'6px', border:'1px solid #222'}}><b style={{fontSize:'11px'}}>{c.nome}</b><br/><small style={{color:'#888'}}>{c.tipo} {c.dist?`- ${c.dist}m`:''}</small><br/>{c.lat && <button onClick={()=>calcularRota(c.lat,c.lng,latClick,lngClick,c.nome)} style={{marginTop:'6px', padding:'4px 8px', fontSize:'10px', background:'#222', color:'#fff', border:'none', borderRadius:'4px'}}>Ver rota</button>}</div>)}</div></div>
              <div ref={mapResultRef} style={{height:'400px', marginTop:'15px', borderRadius:'8px', overflow:'hidden'}}></div>
            </div>
          )}

          {aba==='obras' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}>
              <b>Tipos de Obra & Fundação</b>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'12px'}}>
                <div style={{background:'#0a0a12', padding:'12px', borderRadius:'8px', border:'1px solid #333'}}><b style={{color:'#D4AF37'}}>1. Convencional - Tijolo Cerâmico</b><br/><small style={{color:'#aaa'}}>Mão de obra barata, flexível. Ideal térrea personalizada. Custo base CUB. Dica: tijolo 9x19x19 deitado melhor acústica.</small></div>
                <div style={{background:'#0a0a12', padding:'12px', borderRadius:'8px', border:'1px solid #333'}}><b style={{color:'#D4AF37'}}>2. Estrutural - Bloco Concreto</b><br/><small style={{color:'#aaa'}}>30% mais rápido, sem pilares. Ideal casas em série 2-3 pisos. Custo -8%. Dica: bloco 14x19x39 graute a cada 2m.</small></div>
                <div style={{background:'#0a0a12', padding:'12px', borderRadius:'8px', border:'1px solid #333'}}><b style={{color:'#D4AF37'}}>3. Parede Concreto - Forma Alumínio</b><br/><small style={{color:'#aaa'}}>1 casa/dia, zero infiltração. Ideal 50+ casas 3 pisos. Custo -12% escala. Dica: concreto 25Mpa com impermeabilizante.</small></div>
              </div>
              <div style={{marginTop:'15px', background:'#000', padding:'15px', borderRadius:'8px', border:'1px solid #222'}}>
                <b style={{color:'#00ff88'}}>Fundação por tipo</b>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'10px', fontSize:'11px'}}>
                  <div><b>Térrea 70-120m2</b><br/>Sapata corrida 50x60 + baldrame 15x40 20Mpa ou Radier 12cm Q138. Custo R$90-130/m2</div>
                  <div><b>2 Pisos 150-200m2</b><br/>Sapata 80x80x50 + broca 6m + baldrame 15x50 4x10mm. Custo R$140-180/m2</div>
                  <div><b>3 Pisos 200-300m2 - exige SPT</b><br/>Estaca Ø30 8-12m + bloco 60x60 + viga 20x50. Custo R$200-280/m2. SPT R$800 Brasília</div>
                </div>
              </div>
              <div style={{marginTop:'15px', background:'#1a1a2e', padding:'15px', borderRadius:'8px', borderLeft:'3px solid #00ff88'}}>
                <b>Impermeabilização Anti-Umidade Solo</b><br/><small style={{color:'#ccc'}}>1. Baldrame: emulsão asfáltica 2 demãos + manta 3mm até 30cm acima solo<br/>2. 3 fiadas com Vedacit 1:100 + pintura asfáltica antes chapisco<br/>3. Radier: lona 200 micras + 5cm brita + manta PEAD<br/>4. Ouro: bloco concreto até 60cm + Xypex cristalizante - nunca infiltra<br/>5. Dreno tubo 100mm com brita e bidim ao redor</small>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
