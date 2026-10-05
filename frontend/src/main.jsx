import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import jsPDF from 'jspdf'

const API = import.meta.env.VITE_API_URL || "https://sensoriall-insight-dashboard.onrender.com"

function App(){
  const [token, setToken] = useState(localStorage.getItem('token')||'')
  const [email, setEmail] = useState('claudioms123@gmail.com')
  const [senha, setSenha] = useState('')
  const [modo, setModo] = useState('login')
  const [cidade, setCidade] = useState('Brasília')
  const [endereco, setEndereco] = useState('')
  const [orcamento, setOrcamento] = useState(2000000)
  const [finalidade, setFinalidade] = useState('investir')
  const [latClick, setLatClick] = useState(null)
  const [lngClick, setLngClick] = useState(null)
  const [data, setData] = useState(null)
  const [aba, setAba] = useState('viabilidade')
  const [msg, setMsg] = useState('')
  const [debug, setDebug] = useState('')

  const [origem, setOrigem] = useState('')
  const [rotas, setRotas] = useState([])
  const [comercios, setComercios] = useState([])
  const [rotaAtual, setRotaAtual] = useState(null)

  const mapSelectRef = useRef(null)
  const mapResultRef = useRef(null)
  const mapSelectInstance = useRef(null)
  const mapResultInstance = useRef(null)
  const markerSelect = useRef(null)

  useEffect(()=>{
    if(!mapSelectRef.current || mapSelectInstance.current) return
    mapSelectInstance.current = L.map(mapSelectRef.current).setView([-15.79,-47.88], 4)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapSelectInstance.current)
    mapSelectInstance.current.on('click', async (e)=>{
      setLatClick(e.latlng.lat); setLngClick(e.latlng.lng)
      if(markerSelect.current) mapSelectInstance.current.removeLayer(markerSelect.current)
      markerSelect.current = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapSelectInstance.current).bindPopup(`Destino<br>${e.latlng.lat.toFixed(5)}`).openPopup()
      try{
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${e.latlng.lat}&lon=${e.latlng.lng}&format=json`)
        const j = await r.json()
        if(j.display_name) setEndereco(j.display_name)
      }catch{}
    })
    setTimeout(()=> mapSelectInstance.current.invalidateSize(), 500)
  },[])

  useEffect(()=>{
    if((aba!=='mapa' && aba!=='rotas') || !data || !mapResultRef.current) return
    const lat = data?.mercado?.lat_click || data?.mercado?.lat || latClick || -15.79
    const lng = data?.mercado?.lng_click || data?.mercado?.lng || lngClick || -47.88
    if(mapResultInstance.current) mapResultInstance.current.remove()
    mapResultInstance.current = L.map(mapResultRef.current).setView([lat,lng], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapResultInstance.current)
    L.marker([lat,lng]).addTo(mapResultInstance.current).bindPopup(`${data?.cidade || cidade}`).openPopup()
    setTimeout(()=> mapResultInstance.current.invalidateSize(), 300)
  },[aba, data, latClick, lngClick])

  const login = async ()=>{
    setMsg('Entrando...'); setDebug('')
    try{
      let r = await fetch(`${API}/auth/login`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: senha})})
      let txt = await r.text(); let j={}; try{j=JSON.parse(txt)}catch{j={detail:txt}}
      setDebug(`Login T1 Status ${r.status}: ${txt.slice(0,400)}`)
      if(!r.ok){
        r = await fetch(`${API}/login`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: senha})})
        txt = await r.text(); try{j=JSON.parse(txt)}catch{j={detail:txt}}
        setDebug(prev=>prev+`\\nT2 Status ${r.status}: ${txt.slice(0,400)}`)
      }
      if(!r.ok){
        const fd = new FormData(); fd.append('username', email); fd.append('password', senha)
        r = await fetch(`${API}/auth/login`,{method:'POST', body: fd})
        txt = await r.text(); try{j=JSON.parse(txt)}catch{j={detail:txt}}
        setDebug(prev=>prev+`\\nT3 Status ${r.status}: ${txt.slice(0,400)}`)
      }
      const tk = j.access_token || j.token || j.accessToken || j.access
      if(!r.ok || !tk){
        const det = typeof j.detail==='object' ? JSON.stringify(j.detail) : (j.detail||j.msg||txt)
        throw new Error(det.slice(0,400))
      }
      localStorage.setItem('token', tk); setToken(tk); setMsg(''); setDebug('')
    }catch(e){ setMsg(String(e.message||e).slice(0,600)) }
  }

  const registrar = async ()=>{
    setMsg('Cadastrando...'); setDebug('')
    try{
      let r = await fetch(`${API}/auth/register`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: senha})})
      let txt = await r.text()
      setDebug(`Cadastro T1 Status ${r.status}: ${txt.slice(0,400)}`)
      if(!r.ok){
        r = await fetch(`${API}/register`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: senha})})
        txt = await r.text()
        setDebug(prev=>prev+`\\nT2 Status ${r.status}: ${txt.slice(0,400)}`)
      }
      if(!r.ok) throw new Error(`Erro ${r.status}: ${txt.slice(0,300)}`)
      setMsg('Cadastrado! Clique em Entrar'); setModo('login')
    }catch(e){ setMsg(String(e.message).slice(0,500)) }
  }

  const logout = ()=>{ localStorage.removeItem('token'); setToken(''); setData(null) }

  const analisar = async ()=>{
    if(!cidade){ setMsg('Digite a cidade'); return }
    setMsg('Analisando...'); setDebug(`Backend: ${API} - acordando se necessário...`)
    try{
      const r = await fetch(`${API}/analisar`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({cidade, endereco, orcamento: Number(orcamento)||2000000, finalidade: (finalidade==='morar'?'morar':'investir'), finalidade_original: finalidade, lat: latClick, lng: lngClick})
      })
      const j = await r.json()
      if(!r.ok){
        if(r.status===401){ logout(); throw new Error('Sessão expirou, faça login de novo') }
        throw new Error(typeof j.detail==='object'?JSON.stringify(j.detail):(j.detail||'Erro'))
      }
      setData(j); setAba('viabilidade'); setMsg(''); setDebug('')
    }catch(e){ setMsg(String(e.message).slice(0,600)) }
  }

  const buscarComercios = async ()=>{
    if(!latClick){ setMsg('Clique no mapa para definir destino'); return }
    setComercios([{nome:'Buscando comércios em 3km...', tipo:'...'}])
    try{
      const query = `[out:json];(node["shop"="supermarket"](around:3000,${latClick},${lngClick});node["amenity"="school"](around:3000,${latClick},${lngClick});node["amenity"="hospital"](around:3000,${latClick},${lngClick});node["amenity"="pharmacy"](around:3000,${latClick},${lngClick});node["shop"="mall"](around:3000,${latClick},${lngClick});node["amenity"="bank"](around:3000,${latClick},${lngClick}););out 12;`
      const r = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
      const j = await r.json()
      const lista = (j.elements||[]).slice(0,10).map(el=>({
        nome: el.tags.name || el.tags.shop || el.tags.amenity || 'Comércio',
        tipo: el.tags.shop || el.tags.amenity || 'comércio',
        lat: el.lat, lng: el.lon,
        dist: Math.round(Math.sqrt(Math.pow(el.lat-latClick,2)+Math.pow(el.lon-lngClick,2))*111*1000)
      }))
      setComercios(lista.length? lista : [{nome:'Região com poucos comércios cadastrados no OSM', tipo:'rural'}])
    }catch(e){ setComercios([{nome:'Erro Overpass - tente novamente', tipo:'erro'}]) }
  }

  const calcularRota = async (latO, lngO, latD, lngD, nome='Rota')=>{
    try{
      setMsg(`Calculando ${nome}...`)
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${lngO},${latO};${lngD},${latD}?overview=full&geometries=geojson`)
      const j = await r.json()
      if(!j.routes || !j.routes[0]) throw new Error('Rota não encontrada')
      const coords = j.routes[0].geometry.coordinates.map(c=>[c[1], c[0]])
      const dist = (j.routes[0].distance/1000).toFixed(1)
      const tempo = Math.round(j.routes[0].duration/60)
      const m = mapResultInstance.current || mapSelectInstance.current
      if(m){
        if(rotaAtual) m.removeLayer(rotaAtual)
        const poly = L.polyline(coords, {color:'#8a5cf5', weight:5, opacity:0.9}).addTo(m)
        m.fitBounds(poly.getBounds())
        setRotaAtual(poly)
      }
      setRotas(prev=> [{nome, dist, tempo}, ...prev].slice(0,6))
      setMsg('')
    }catch(e){ setMsg(e.message) }
  }

  const gerarPDF = ()=>{
    if(!data){ setMsg('Analise primeiro'); return }
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text(`Sensoriall - Viabilidade ${data.cidade}`, 10, 15)
    doc.setFontSize(10); doc.text(`Endereco: ${endereco||cidade} | Finalidade: ${finalidade} | Data: ${new Date().toLocaleDateString('pt-BR')}`, 10, 22)
    doc.text(`Orcamento: R$ ${Number(orcamento).toLocaleString('pt-BR')} | CUB: R$ ${data.cub.valor} | Ticket: R$ ${data.mercado.ticket}/m2`, 10, 28)
    doc.text(`Local escolhido: ${latClick? latClick.toFixed(5)+', '+lngClick.toFixed(5) : 'Centro da cidade'}`, 10, 34)
    let y=42
    doc.setFontSize(12); doc.text('PACOTE 10 ITENS - Mais rentavel: '+data.mais_rentavel.faixa, 10, y); y+=6
    doc.setFontSize(9)
    Object.entries(data.faixas).forEach(([k,v])=>{
      doc.text(`${k.toUpperCase()} - ${v.material.nome} - Custo m2 R$${v.custo_m2} - Venda R$${v.preco_m2} - Margem ${v.margem_bruta}% - Lucro R$${v.lucro.toLocaleString('pt-BR')}`, 10, y); y+=5
      if(v.pacote_detalhado) v.pacote_detalhado.slice(0,3).forEach(it=>{ doc.text(` - ${it}`, 12, y); y+=4 })
      y+=2; if(y>270){ doc.addPage(); y=10 }
    })
    y+=6; doc.setFontSize(11); doc.text('ROTAS E ACESSOS:', 10, y); y+=6
    doc.setFontSize(9); rotas.forEach(r=>{ doc.text(`${r.nome}: ${r.dist} km - ${r.tempo} min`, 10, y); y+=5 })
    comercios.slice(0,5).forEach(c=>{ doc.text(`Comercio proximo: ${c.nome} (${c.tipo}) - ${c.dist||''}m`, 10, y); y+=5 })
    doc.save(`Sensoriall_${data.cidade}_${finalidade}.pdf`)
  }

  if(!token){
    return (
      <div style={{background:'#0a0a12', color:'#fff', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter'}}>
        <div style={{background:'#151525', padding:'30px', borderRadius:'12px', width:'420px'}}>
          <h3>Sensoriall - {modo==='login'?'Login':'Criar Conta'}</h3>
          <div style={{display:'flex', gap:'8px', margin:'12px 0'}}>
            <button onClick={()=>setModo('login')} style={{flex:1, padding:'8px', background: modo==='login'?'#8a5cf5':'#222', border:'none', color:'#fff', borderRadius:'6px'}}>Entrar</button>
            <button onClick={()=>setModo('cadastro')} style={{flex:1, padding:'8px', background: modo==='cadastro'?'#8a5cf5':'#222', border:'none', color:'#fff', borderRadius:'6px'}}>Cadastrar</button>
          </div>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Seu email" style={{width:'100%', padding:'10px', marginTop:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Senha" style={{width:'100%', padding:'10px', marginTop:'8px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          {modo==='login' ? <button onClick={login} style={{width:'100%', marginTop:'12px', background:'#8a5cf5', padding:'12px', borderRadius:'8px', border:'none', color:'#fff', fontWeight:'bold'}}>Entrar</button>
          : <button onClick={registrar} style={{width:'100%', marginTop:'12px', background:'#00ff88', padding:'12px', borderRadius:'8px', border:'none', color:'#000', fontWeight:'bold'}}>Cadastrar Novo</button>}
          {msg && <div style={{color: msg.includes('Cadastrado')?'#00ff88':'tomato', fontSize:'12px', marginTop:'8px', wordBreak:'break-all'}}>{msg}</div>}
          {debug && <div style={{background:'#000', padding:'8px', marginTop:'8px', fontSize:'10px', color:'#888', borderRadius:'4px', maxHeight:'120px', overflowY:'auto', whiteSpace:'pre-wrap'}}>{debug}</div>}
          <small style={{color:'#666', display:'block', marginTop:'12px'}}>Se der Failed to fetch, abra {API}/docs em outra aba e espere 50s (Render dorme)</small>
        </div>
      </div>
    )
  }

  return (
    <div style={{background:'#0a0a12', color:'#fff', minHeight:'100vh', padding:'15px', fontFamily:'Inter'}}>
      <div style={{display:'flex', justifyContent:'space-between'}}><small style={{color:'#888'}}>Logado {email} | <span onClick={logout} style={{color:'#8a5cf5', cursor:'pointer', textDecoration:'underline'}}>Sair</span></small><button onClick={gerarPDF} style={{background:'#D4AF37', color:'#000', border:'none', padding:'6px 12px', borderRadius:'6px', fontWeight:'bold', cursor:'pointer'}}>📄 Gerar PDF</button></div>
      
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginTop:'10px'}}>
        <div style={{background:'#151525', padding:'15px', borderRadius:'12px'}}>
          <b>1. Busca, Orçamento e Mapa - Clique no mapa</b><br/>
          <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Brasília" style={{width:'100%', marginTop:'10px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Endereço (auto)" style={{width:'100%', marginTop:'8px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <div style={{display:'flex', gap:'8px', marginTop:'8px'}}>
            <input type="number" value={orcamento} onChange={e=>setOrcamento(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
            <select value={finalidade} onChange={e=>setFinalidade(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}>
              <option value="investir">Investir</option>
              <option value="revenda">Revenda</option>
              <option value="morar">Morar</option>
              <option value="aluguel">Aluguel / Renda</option>
              <option value="comercial">Comercial / Galpão</option>
            </select>
          </div>
          {latClick && <div style={{marginTop:'8px', fontSize:'11px', color:'#D4AF37'}}>📍 {latClick.toFixed(5)}, {lngClick.toFixed(5)}</div>}
          <button onClick={analisar} style={{width:'100%', marginTop:'12px', background:'#8a5cf5', padding:'12px', borderRadius:'8px', border:'none', color:'#fff', fontWeight:'bold', cursor:'pointer'}}>Analisar com Local do Mapa</button>
          {msg && <div style={{color: msg.includes('Analisando')?'#D4AF37':'tomato', fontSize:'12px', marginTop:'8px'}}>{msg}</div>}
          {debug && <div style={{fontSize:'10px', color:'#666', marginTop:'6px'}}>{debug}</div>}
        </div>
        <div style={{background:'#151525', borderRadius:'12px', overflow:'hidden'}}>
          <div style={{padding:'8px', fontSize:'10px', color:'#888'}}>MAPA - CLIQUE PARA ESCOLHER DESTINO</div>
          <div ref={mapSelectRef} style={{height:'300px'}}></div>
        </div>
      </div>

      {data && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginTop:'15px'}}>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #D4AF37'}}><small>CUB REAL</small><br/><b>R${data.cub.valor}</b></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #8a5cf5'}}><small>TICKET REAL</small><br/><b>R${data.mercado.ticket}/m²</b></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #00ff88'}}><small>MAIS RENTÁVEL</small><br/><b>{data.mais_rentavel.faixa} {data.mais_rentavel.dados.margem_bruta}%</b></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px'}}><small>PDF</small><br/><b onClick={gerarPDF} style={{cursor:'pointer', textDecoration:'underline'}}>Gerar Dossiê</b></div>
          </div>

          <div style={{display:'flex', gap:'8px', marginTop:'15px', flexWrap:'wrap'}}>
            {['viabilidade','mercado','mapa','rotas','obras','marketing'].map(t=>(
              <button key={t} onClick={()=>setAba(t)} style={{padding:'6px 14px', borderRadius:'6px', background: aba===t? '#8a5cf5':'#222', color:'#fff', border:'none', cursor:'pointer', textTransform:'capitalize'}}>{t}</button>
            ))}
          </div>

          {aba==='viabilidade' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}>
              <b>Viabilidade - PACOTE 10 ITENS (Porcelanato dentro)</b>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'12px'}}>
                {Object.entries(data.faixas).map(([k,v])=>(
                  <div key={k} style={{background:'#0a0a12', padding:'15px', borderRadius:'8px', border: data.mais_rentavel.faixa===k? '2px solid #D4AF37':'1px solid #333'}}>
                    <b style={{color: data.mais_rentavel.faixa===k? '#D4AF37':'#fff'}}>{v.material.nome}</b>
                    <div style={{marginTop:'8px', fontSize:'12px'}}>
                      <div>Custo m²: R${v.custo_m2}</div><div>Venda m²: R${v.preco_m2}</div><div>Margem: {v.margem_bruta}%</div><div>Lucro: R${v.lucro.toLocaleString('pt-BR')}</div>
                    </div>
                    <div style={{marginTop:'10px', background:'#000', padding:'8px', borderRadius:'6px', maxHeight:'180px', overflowY:'auto', border:'1px solid #222'}}>
                      <b style={{fontSize:'10px', color:'#D4AF37'}}>PACOTE 10 ITENS:</b>
                      {v.pacote_detalhado?.map((it,i)=><div key={i} style={{fontSize:'10px', color:'#aaa', padding:'2px 0', borderBottom:'1px solid #111'}}>{it}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aba==='rotas' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}>
              <b>Rotas & Acessos - Destino: {latClick? `${latClick.toFixed(5)}, ${lngClick.toFixed(5)}` : 'Clique no mapa acima'}</b>
              <div style={{display:'flex', gap:'8px', marginTop:'10px', flexWrap:'wrap'}}>
                <input value={origem} onChange={e=>setOrigem(e.target.value)} placeholder="Origem: Rodoviária, ou lat,lng" style={{flex:1, minWidth:'200px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
                <button onClick={()=>{
                  if(!origem || !latClick) return
                  if(origem.includes(',')){ const [la, lo]=origem.split(',').map(Number); calcularRota(la, lo, latClick, lngClick, `Manual ${origem}`)}
                  else { fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(origem)}&format=json&limit=1`).then(r=>r.json()).then(j=>{ if(j[0]) calcularRota(Number(j[0].lat), Number(j[0].lon), latClick, lngClick, j[0].display_name.slice(0,40)) }) }
                }} style={{padding:'10px 16px', background:'#8a5cf5', border:'none', color:'#fff', borderRadius:'6px'}}>Calcular Rota Manual</button>
                <button onClick={()=>{
                  if(navigator.geolocation) navigator.geolocation.getCurrentPosition(p=> calcularRota(p.coords.latitude, p.coords.longitude, latClick, lngClick, 'Minha localização'))
                }} style={{padding:'10px 12px', background:'#222', border:'none', color:'#fff', borderRadius:'6px'}}>📍 Meu GPS</button>
                <button onClick={buscarComercios} style={{padding:'10px 12px', background:'#D4AF37', border:'none', color:'#000', borderRadius:'6px', fontWeight:'bold'}}>Buscar Comércios 3km</button>
              </div>
              {rotas.length>0 && <div style={{marginTop:'12px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px'}}>{rotas.map((r,i)=><div key={i} style={{background:'#0a0a12', padding:'10px', borderRadius:'6px', border:'1px solid #333'}}><b style={{fontSize:'11px'}}>{r.nome}</b><br/><small>{r.dist} km - {r.tempo} min</small></div>)}</div>}
              <div style={{marginTop:'15px'}}><b style={{color:'#D4AF37'}}>Comércios Principais (automático)</b>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginTop:'8px'}}>
                  {comercios.map((c,i)=><div key={i} style={{background:'#000', padding:'10px', borderRadius:'6px', border:'1px solid #222'}}><b style={{fontSize:'11px'}}>{c.nome}</b><br/><small style={{color:'#888'}}>{c.tipo} {c.dist? `- ${c.dist}m`:''}</small><br/>{c.lat && <button onClick={()=>calcularRota(c.lat, c.lng, latClick, lngClick, c.nome)} style={{marginTop:'6px', padding:'4px 8px', fontSize:'10px', background:'#222', color:'#fff', border:'none', borderRadius:'4px'}}>Ver rota</button>}</div>)}
                </div>
              </div>
              <div ref={mapResultRef} style={{height:'400px', marginTop:'15px', borderRadius:'8px', overflow:'hidden'}}></div>
            </div>
          )}

          {aba==='obras' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}>
              <b>Tipos de Obra & Fundação - Guia Técnico Sensoriall</b>
              
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'12px'}}>
                <div style={{background:'#0a0a12', padding:'12px', borderRadius:'8px', border:'1px solid #333'}}>
                  <b style={{color:'#D4AF37'}}>1. Convencional - Tijolo Cerâmico</b><br/>
                  <small style={{color:'#aaa'}}>Vantagem: Mão de obra barata, flexível. Desvantagem: Mais lento, mais entulho. Ideal para: Casa térrea personalizada, reformas. Custo: Base CUB. Dica: Use tijolo baiano 9x19x19 deitado para melhor acústica.</small>
                </div>
                <div style={{background:'#0a0a12', padding:'12px', borderRadius:'8px', border:'1px solid #333'}}>
                  <b style={{color:'#D4AF37'}}>2. Alvenaria Estrutural - Bloco Concreto</b><br/>
                  <small style={{color:'#aaa'}}>Vantagem: 30% mais rápido, sem pilares, economia de forma. Desvantagem: Não pode quebrar parede depois. Ideal: Casas em série, 2-3 pisos. Custo: -8% vs convencional. Dica: Bloco 14x19x39 com graute a cada 2m e verga 10cm.</small>
                </div>
                <div style={{background:'#0a0a12', padding:'12px', borderRadius:'8px', border:'1px solid #333'}}>
                  <b style={{color:'#D4AF37'}}>3. Parede de Concreto - Forma Alumínio</b><br/>
                  <small style={{color:'#aaa'}}>Vantagem: 1 casa/dia, altíssima resistência, zero infiltração se bem feito. Desvantagem: Investimento forma. Ideal: Loteamento 50+ casas, 3 pisos. Custo: -12% em escala. Dica: Concreto 25Mpa com aditivo impermeabilizante.</small>
                </div>
              </div>

              <div style={{marginTop:'15px', background:'#000', padding:'15px', borderRadius:'8px', border:'1px solid #222'}}>
                <b style={{color:'#00ff88'}}>Fundação - Melhor Estrutura por Tipo de Casa</b>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'10px', fontSize:'11px'}}>
                  <div><b>Térrea (70-120m2) - Solo firme Brasília</b><br/>- Sapata corrida 50cm larg x 60cm alt, com baldrame 15x40, concreto 20Mpa<br/>- Ou Radier 12cm + tela Q138 se solo compacto<br/>- Custo: R$ 90-130/m2</div>
                  <div><b>2 Pisos (150-200m2)</b><br/>- Sapata isolada 80x80x50 + pilar 15x30, broca 6m até moledo<br/>- Baldrame 15x50 armado 4x10mm<br/>- Custo: R$ 140-180/m2</div>
                  <div><b>3 Pisos (200-300m2) - Exige sondagem SPT</b><br/>- Estaca escavada Ø30cm 8-12m + bloco de coroamento 60x60<br/>- Viga baldrame 20x50<br/>- Custo: R$ 200-280/m2<br/>- Sempre sondagem SPT (R$ 800 em Brasília)</div>
                </div>
              </div>

              <div style={{marginTop:'15px', background:'#1a1a2e', padding:'15px', borderRadius:'8px', borderLeft:'3px solid #00ff88'}}>
                <b>Impermeabilização - Evitar Umidade do Solo (Crítico em Brasília)</b><br/>
                <small style={{color:'#ccc'}}>
                  1. Baldrame: Pinte com emulsão asfáltica 2 demãos + manta asfáltica 3mm na lateral até 30cm acima do solo<br/>
                  2. Base parede: 3 fiadas com argamassa com Vedacit 1:100 + pintura asfáltica antes do chapisco<br/>
                  3. Radier: Lona plástica 200 micras + 5cm brita + manta PEAD<br/>
                  4. Melhor forma: Use bloco de concreto até 60cm altura (cinta) + impermeabilizante cristalizante (Xypex) - nunca mais infiltra<br/>
                  5. Dreno: Ao redor da casa, tubo dreno 100mm com brita e manta bidim para lençol freático<br/>
                  Dica de ouro Brasília: Solo argiloso retém água - sempre faça caixa de brita 40cm ao redor da fundação.
                </small>
              </div>
            </div>
          )}

          {aba==='mapa' && <div style={{marginTop:'15px', background:'#151525', padding:'10px', borderRadius:'12px'}}><div ref={mapResultRef} style={{height:'450px'}}></div></div>}
        </>
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
