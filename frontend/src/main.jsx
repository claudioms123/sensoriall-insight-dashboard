import React, { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const API = import.meta.env.VITE_API_URL || "https://sensoriall-backend.onrender.com"

export default function App(){
  const [email, setEmail] = useState(localStorage.getItem('email')||'')
  const [token, setToken] = useState(localStorage.getItem('token')||'')
  const [cidade, setCidade] = useState('Brasília')
  const [endereco, setEndereco] = useState('')
  const [orcamento, setOrcamento] = useState(2000000)
  const [finalidade, setFinalidade] = useState('investir')
  const [latClick, setLatClick] = useState(null)
  const [lngClick, setLngClick] = useState(null)
  const [data, setData] = useState(null)
  const [aba, setAba] = useState('viabilidade')
  const [msg, setMsg] = useState('')

  const mapSelectRef = useRef(null)
  const mapResultRef = useRef(null)
  const mapSelectInstance = useRef(null)
  const mapResultInstance = useRef(null)
  const markerSelect = useRef(null)

  // MAPA 1 - seleção com pino dourado
  useEffect(()=>{
    if(!mapSelectRef.current || mapSelectInstance.current) return
    mapSelectInstance.current = L.map(mapSelectRef.current).setView([-15.79,-47.88], 4)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapSelectInstance.current)
    mapSelectInstance.current.on('click', async (e)=>{
      setLatClick(e.latlng.lat); setLngClick(e.latlng.lng)
      if(markerSelect.current) mapSelectInstance.current.removeLayer(markerSelect.current)
      markerSelect.current = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapSelectInstance.current).bindPopup(`Local escolhido<br>${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`).openPopup()
      try{
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${e.latlng.lat}&lon=${e.latlng.lng}&format=json`)
        const j = await r.json()
        if(j.display_name) setEndereco(j.display_name)
      }catch{}
    })
    setTimeout(()=> mapSelectInstance.current.invalidateSize(), 500)
  },[])

  // MAPA 2 - resultado (fix tela preta)
  useEffect(()=>{
    if(aba!=='mapa' || !data || !mapResultRef.current) return
    const lat = data.mercado.lat_click || data.mercado.lat
    const lng = data.mercado.lng_click || data.mercado.lng
    if(mapResultInstance.current) mapResultInstance.current.remove()
    mapResultInstance.current = L.map(mapResultRef.current).setView([lat,lng], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapResultInstance.current)
    L.marker([lat,lng]).addTo(mapResultInstance.current).bindPopup(`${data.cidade}<br>Ticket R$${data.mercado.ticket}`).openPopup()
    setTimeout(()=> mapResultInstance.current.invalidateSize(), 300)
  },[aba, data])

  const analisar = async ()=>{
    if(!cidade){ setMsg('Digite a cidade'); return }
    setMsg('Analisando...')
    try{
      const r = await fetch(`${API}/analisar`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body: JSON.stringify({cidade, endereco, orcamento: Number(orcamento)||2000000, finalidade, lat: latClick, lng: lngClick})
      })
      const j = await r.json()
      if(!r.ok) throw new Error(j.detail || JSON.stringify(j).substring(0,200))
      setData(j); setAba('viabilidade'); setMsg('')
    }catch(e){ setMsg(e.message) }
  }

  if(!token){
    return <div style={{padding:20, background:'#0a0a12', color:'#fff', minHeight:'100vh'}}>Faça login no backend /auth/login para gerar token<br/><small>Depois cola no localStorage token</small></div>
  }

  return (
    <div style={{background:'#0a0a12', color:'#fff', minHeight:'100vh', padding:'15px', fontFamily:'Inter, sans-serif'}}>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
        <div style={{background:'#151525', padding:'15px', borderRadius:'12px'}}>
          <b>1. Busca, Orçamento e Mapa - Clique no mapa para escolher</b><br/>
          <small style={{color:'#888'}}>Você pode digitar OU navegar no mapa ao lado e clicar - funciona dos dois jeitos</small>
          <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Brasília" style={{width:'100%', marginTop:'10px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Endereço específico (preenchido ao clicar no mapa)" style={{width:'100%', marginTop:'8px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <div style={{display:'flex', gap:'8px', marginTop:'8px'}}>
            <input type="number" value={orcamento} onChange={e=>setOrcamento(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
            <select value={finalidade} onChange={e=>setFinalidade(e.target.value)} style={{flex:1, padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}>
              <option value="investir">Investir / Revenda</option>
              <option value="morar">Morar</option>
            </select>
          </div>
          {latClick && <div style={{marginTop:'8px', fontSize:'11px', color:'#D4AF37'}}>📍 Local clicado: {latClick.toFixed(5)}, {lngClick.toFixed(5)} - será usado como referência</div>}
          <button onClick={analisar} style={{width:'100%', marginTop:'12px', background:'#8a5cf5', padding:'12px', borderRadius:'8px', border:'none', color:'#fff', fontWeight:'bold', cursor:'pointer'}}>Analisar com Local do Mapa</button>
          {msg && <div style={{color:'tomato', fontSize:'12px', marginTop:'8px'}}>{msg}</div>}
        </div>
        <div style={{background:'#151525', borderRadius:'12px', overflow:'hidden'}}>
          <div style={{padding:'8px', fontSize:'10px', color:'#888'}}>MAPA INTERATIVO - NAVEGUE E CLIQUE PARA ESCOLHER</div>
          <div ref={mapSelectRef} style={{height:'300px'}}></div>
        </div>
      </div>

      {data && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginTop:'15px'}}>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #D4AF37'}}><small>CUB REAL</small><br/><b>R${data.cub.valor}</b><br/><small>{data.cub.fonte}</small></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #8a5cf5'}}><small>TICKET REAL</small><br/><b>R${data.mercado.ticket}/m²</b><br/><small>VivaReal 90d - {data.cidade}</small></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #00ff88'}}><small>MAIS RENTÁVEL</small><br/><b>{data.mais_rentavel.faixa} {data.mais_rentavel.dados.margem_bruta}%</b><br/><small>Lucro R${data.mais_rentavel.dados.lucro.toLocaleString('pt-BR')}</small></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #fff'}}><small>LOCAL MAPA</small><br/><b>{latClick? 'Pino dourado' : 'Cidade central'}</b><br/><small>{data.cidade}</small></div>
          </div>

          <div style={{display:'flex', gap:'8px', marginTop:'15px', flexWrap:'wrap'}}>
            {['viabilidade','cerebro','mercado','mapa','marketing','executivo'].map(t=>(
              <button key={t} onClick={()=>setAba(t)} style={{padding:'6px 12px', borderRadius:'6px', background: aba===t? '#8a5cf5':'#222', color:'#fff', border:'none', textTransform:'capitalize', cursor:'pointer'}}>{t==='cerebro'?'Cérebro Construtor':t==='mapa'?'Mapa Resultado':t}</button>
            ))}
          </div>

          {aba==='viabilidade' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}>
              <b>Viabilidade - CUB + Material vs Venda - PACOTE 10 ITENS</b>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'12px'}}>
                {Object.entries(data.faixas).map(([k,v])=>(
                  <div key={k} style={{background:'#0a0a12', padding:'15px', borderRadius:'8px', border: data.mais_rentavel.faixa===k? '2px solid #D4AF37':'1px solid #333'}}>
                    <b style={{color: data.mais_rentavel.faixa===k? '#D4AF37':'#fff'}}>{v.material.nome}</b><br/><small>{v.material.pisos}</small><br/>
                    <div style={{marginTop:'8px', fontSize:'12px'}}>
                      <div>Custo m²: R${v.custo_m2}</div>
                      <div>Venda m²: R${v.preco_m2}</div>
                      <div>Margem: {v.margem_bruta}%</div>
                      <div>Lucro: R${v.lucro.toLocaleString('pt-BR')}</div>
                    </div>
                    {/* AQUI OS 10 ITENS - ERA ISSO QUE FALTAVA */}
                    <div style={{marginTop:'12px', background:'#000', padding:'10px', borderRadius:'6px', maxHeight:'200px', overflowY:'auto', border:'1px solid #222'}}>
                      <b style={{fontSize:'10px', color:'#D4AF37'}}>PACOTE COMPLETO 10 ITENS:</b>
                      {v.pacote_detalhado?.map((it,i)=><div key={i} style={{fontSize:'10px', color:'#aaa', padding:'3px 0', borderBottom:'1px solid #111'}}>{it}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {aba==='mapa' && <div style={{marginTop:'15px', background:'#151525', padding:'10px', borderRadius:'12px'}}><div ref={mapResultRef} style={{height:'450px', borderRadius:'8px'}}></div></div>}
          {aba==='marketing' && <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}><b>Copies Elevation - {data.cidade}</b>{data.copies_elevation.map((c,i)=><div key={i} style={{marginTop:'8px', padding:'10px', background:'#000', borderRadius:'6px', fontSize:'12px'}}>{c}</div>)}<br/><b>Roteiros Drone 4K</b>{data.roteiros_drones.map((c,i)=><div key={i} style={{marginTop:'8px', padding:'10px', background:'#000', borderRadius:'6px', fontSize:'12px'}}>{c}</div>)}</div>}
          {aba==='mercado' && <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}><b>Mercado Real - {data.cidade}</b><br/>Pop: {data.ibge.populacao} - {data.ibge.vocacao}<br/>Renda: R${data.ibge.renda_media}</div>}
        </>
      )}
    </div>
  )
}
