import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App(){
  const [token, setToken] = useState(localStorage.getItem('sensoriall_token'))
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [msg, setMsg] = useState('')
  const [cidade, setCidade] = useState('')
  const [endereco, setEndereco] = useState('')
  const [orcamento, setOrcamento] = useState(2000000)
  const [finalidade, setFinalidade] = useState('investir')
  const [latClick, setLatClick] = useState(null)
  const [lngClick, setLngClick] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [aba, setAba] = useState('financeira')
  const mapRef = useRef(null)
  const mapResultRef = useRef(null)

  useEffect(()=>{
    if(token){
      fetch(`${API}/auth/me`, {headers: {Authorization: `Bearer ${token}`}})
       .then(r=>r.json()).then(d=>{ if(d.email) setUser(d); else {localStorage.removeItem('sensoriall_token'); setToken(null)} })
       .catch(()=>{localStorage.removeItem('sensoriall_token'); setToken(null)})
    }
  },[token])

  useEffect(()=>{
    if(user){
      setTimeout(()=>{
        const div = document.getElementById('map-select')
        if(!div ||!window.L) return

        // FIX MAPA PRETO - remove mapa antigo se existir
        if(mapRef.current){
          try{ mapRef.current.remove() }catch(e){}
          mapRef.current = null
        }
        if(div._leaflet_id){
          div._leaflet_id = null
        }
        div.innerHTML=''

        const map = window.L.map('map-select').setView([-15.793, -47.882], 4)
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
        map.on('click', (e)=>{
          const {lat, lng} = e.latlng
          setLatClick(lat); setLngClick(lng)
          // NÃO apaga mais a cidade digitada
          setEndereco(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`)
          window.L.marker([lat, lng]).addTo(map).bindPopup(`Local escolhido<br/>${lat.toFixed(4)}, ${lng.toFixed(4)}`).openPopup()
        })
        mapRef.current = map
      },800)
    }
    return ()=>{
      if(mapRef.current){
        try{ mapRef.current.remove() }catch(e){}
        mapRef.current = null
      }
    }
  },[user])

  async function handleAuth(){
    if(!email ||!password){ setMsg('Preencha email e senha'); return }
    const endpoint = isRegister? '/auth/register' : '/auth/login'
    try{
      const res = await fetch(`${API}${endpoint}`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password})})
      const json = await res.json()
      if(!res.ok) throw new Error(json.detail || 'Erro')
      localStorage.setItem('sensoriall_token', json.token)
      setToken(json.token)
      setUser({email: json.email})
      setMsg('')
    }catch(e){ setMsg(e.message) }
  }
  function logout(){
    if(mapRef.current){ try{ mapRef.current.remove() }catch(e){} mapRef.current=null }
    if(mapResultRef.current){ try{ mapResultRef.current.remove() }catch(e){} mapResultRef.current=null }
    localStorage.removeItem('sensoriall_token'); setToken(null); setUser(null); setData(null)
  }

  async function analisar(){
    if(!cidade){ setMsg('Digite cidade ou clique no mapa'); return }
    setLoading(true); setMsg('')
    try{
      const payload = {
        cidade,
        estado: cidade.split(',')[1]?.trim()||'',
        endereco,
        orcamento: Number(orcamento)||2000000,
        finalidade,
        lat: latClick,
        lng: lngClick
      }
      const res = await fetch(`${API}/analisar`, {
        method:'POST',
        headers:{'Content-Type':'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if(!res.ok){
        // FIX [object Object] - FastAPI manda array de erros
        const detail = json.detail
        const message = Array.isArray(detail)? detail.map(d=> d.msg || d.message || JSON.stringify(d)).join(', ') : (detail || JSON.stringify(json))
        throw new Error(message)
      }
      setData(json)
      setTimeout(()=>{
        const mapDiv = document.getElementById('map-result')
        if(mapDiv && json.mercado && window.L){
          if(mapResultRef.current){
            try{ mapResultRef.current.remove() }catch(e){}
            mapResultRef.current = null
          }
          if(mapDiv._leaflet_id){ mapDiv._leaflet_id = null }
          mapDiv.innerHTML = ''
          const map = window.L.map('map-result').setView([json.mercado.lat, json.mercado.lng], 13)
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
          window.L.marker([json.mercado.lat, json.mercado.lng]).addTo(map).bindPopup(`${json.cidade} - ${json.ibge.vocacao}`).openPopup()
          if(json.mercado.lat_click && json.mercado.lng_click){
            window.L.marker([json.mercado.lat_click, json.mercado.lng_click], {icon: window.L.icon({iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [25,41], iconAnchor: [12,41]})}).addTo(map).bindPopup('Local que você clicou no mapa')
          }
          json.concorrencia_real.forEach((c,i)=>{
            window.L.marker([json.mercado.lat + (i+1)*0.01, json.mercado.lng + (i+1)*0.01]).addTo(map).bindPopup(c)
          })
          mapResultRef.current = map
        }
      },500)
    }catch(e){ setMsg(e.message) }
    setLoading(false)
  }

  function baixarHTML(){
    if(!data) return
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Painel ${data.cidade}</title></head><body style="font-family:Inter;background:#0a0a12;color:#fff;padding:30px"><h1 style="color:#8B5CF6">Sensoriall INSIGHT - ${data.cidade}</h1><p>CUB REAL: R$${data.cub.valor} - ${data.cub.fonte}</p><p>Ticket REAL: R$${data.mercado.ticket_m2_venda_real}/m² | Local clicado: ${data.mercado.lat_click}, ${data.mercado.lng_click}</p><p>Mais Rentável: ${data.mais_rentavel.faixa} - ${data.mais_rentavel.dados.margem_bruta}%</p><pre>${JSON.stringify(data.faixas,null,2)}</pre></body></html>`
    const blob = new Blob([html], {type:'text/html'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`Painel-${data.cidade}-${Date.now()}.html`; a.click()
  }

  if(!token ||!user){
    return (
      <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0a12', color:'#fff', fontFamily:'Inter'}}>
        <div style={{background:'#1a1a2e', padding:'40px', borderRadius:'16px', width:'380px', border:'1px solid #333'}}>
          <h1 style={{color:'#8B5CF6', margin:0}}>Sensoriall <span style={{color:'#fff'}}>INSIGHT</span></h1>
          <p style={{color:'#D4AF37', fontSize:'11px', letterSpacing:'2px'}}>V3 MUNDO + MAPA + LOGIN</p>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Seu email" style={{width:'100%', padding:'12px', marginTop:'15px', borderRadius:'8px', background:'#0a0a12', border:'1px solid #333', color:'#fff'}}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha" style={{width:'100%', padding:'12px', marginTop:'10px', borderRadius:'8px', background:'#0a0a12', border:'1px solid #333', color:'#fff'}}/>
          <button onClick={handleAuth} style={{width:'100%', marginTop:'15px', background:'#8B5CF6', color:'#fff', border:'none', padding:'12px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>{isRegister? 'Criar conta e Acessar' : 'Entrar'}</button>
          <button onClick={()=>setIsRegister(!isRegister)} style={{background:'none', border:'none', color:'#888', fontSize:'11px', cursor:'pointer', marginTop:'10px'}}>{isRegister? 'Já tenho conta' : 'Criar nova conta'}</button>
          {msg && <p style={{color:'#ff6b6b', fontSize:'12px'}}>{msg}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{background:'#0a0a12', minHeight:'100vh', color:'#fff', fontFamily:'Inter, sans-serif'}}>
      <div style={{background:'#1a1a2e', padding:'12px 20px', display:'flex', justifyContent:'space-between', borderBottom:'1px solid #333'}}>
        <div><b style={{color:'#8B5CF6'}}>Sensoriall INSIGHT</b> <span style={{fontSize:'10px', color:'#D4AF37', marginLeft:'8px'}}>V3 MUNDO + MAPA NAVEGÁVEL • {user.email}</span></div>
        <div style={{display:'flex', gap:'10px'}}><button onClick={logout} style={{background:'#333', border:'none', color:'#fff', padding:'6px 12px', borderRadius:'6px', fontSize:'11px'}}>Sair</button></div>
      </div>

      <div style={{padding:'20px'}}>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
          <div style={{background:'#1a1a2e', padding:'20px', borderRadius:'12px'}}>
            <h3 style={{margin:'0 0 5px 0'}}>1. Busca, Orçamento e Mapa - Clique no mapa para escolher</h3>
            <p style={{fontSize:'11px', color:'#888'}}>Você pode digitar OU navegar no mapa ao lado e clicar para escolher a localização - terá referência visual</p>
            <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Cidade/Estado ou clique no mapa" style={{width:'100%', padding:'12px', marginTop:'15px', borderRadius:'8px', background:'#0a0a12', border:'1px solid #333', color:'#fff', boxSizing:'border-box'}}/>
            <input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Endereço específico (preenchido ao clicar no mapa)" style={{width:'100%', padding:'12px', marginTop:'10px', borderRadius:'8px', background:'#0a0a12', border:'1px solid #333', color:'#fff', boxSizing:'border-box'}}/>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'10px'}}>
              <input type="number" value={orcamento} onChange={e=>setOrcamento(e.target.value)} placeholder="Orçamento" style={{padding:'12px', borderRadius:'8px', background:'#0a0a12', border:'1px solid #333', color:'#fff'}}/>
              <select value={finalidade} onChange={e=>setFinalidade(e.target.value)} style={{padding:'12px', borderRadius:'8px', background:'#0a0a12', border:'1px solid #333', color:'#fff'}}>
                <option value="investir">Investir / Revenda</option><option value="morar">Morar</option><option value="segunda">Segunda residência</option><option value="renda">Renda</option>
              </select>
            </div>
            {latClick && <p style={{fontSize:'11px', color:'#D4AF37', marginTop:'10px'}}>📍 Local clicado no mapa: {latClick.toFixed(6)}, {lngClick.toFixed(6)} - será usado como referência</p>}
            <button onClick={analisar} style={{marginTop:'15px', background:'#8B5CF6', color:'#fff', border:'none', padding:'12px 20px', borderRadius:'8px', cursor:'pointer', width:'100%', fontWeight:'bold'}}>{loading? 'Analisando...' : 'Analisar com Local do Mapa'}</button>
            {msg && <p style={{color:'#ff6b6b', fontSize:'12px'}}>{msg}</p>}
          </div>
          <div style={{background:'#1a1a2e', padding:'10px', borderRadius:'12px'}}>
            <p style={{fontSize:'11px', color:'#888', margin:'0 0 8px 0'}}>🗺 MAPA INTERATIVO - NAVEGUE E CLIQUE PARA ESCOLHER A LOCALIZAÇÃO (referência visual)</p>
            <div id="map-select" style={{height:'320px', borderRadius:'8px', background:'#0a0a12'}}></div>
            <p style={{fontSize:'10px', color:'#555', marginTop:'6px'}}>Dica: Dê zoom na cidade, navegue, clique no terreno/lote. O endereço será preenchido automaticamente.</p>
          </div>
        </div>

        {data && (
          <>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginTop:'20px'}}>
              <div style={{background:'#1a1a2e', padding:'15px', borderRadius:'10px', borderLeft:'3px solid #D4AF37'}}><div style={{fontSize:'10px', color:'#888'}}>CUB REAL</div><div style={{fontSize:'18px', fontWeight:'bold'}}>R${data.cub.valor}</div><div style={{fontSize:'10px'}}>{data.cub.fonte}</div></div>
              <div style={{background:'#1a1a2e', padding:'15px', borderRadius:'10px', borderLeft:'3px solid #8B5CF6'}}><div style={{fontSize:'10px', color:'#888'}}>TICKET REAL</div><div style={{fontSize:'18px', fontWeight:'bold'}}>R${data.mercado.ticket_m2_venda_real}/m²</div><div style={{fontSize:'10px'}}>VivaReal 90d</div></div>
              <div style={{background:'#1a1a2e', padding:'15px', borderRadius:'10px', borderLeft:'3px solid #10b981'}}><div style={{fontSize:'10px', color:'#888'}}>MAIS RENTÁVEL</div><div style={{fontSize:'18px', fontWeight:'bold'}}>{data.mais_rentavel.faixa} {data.mais_rentavel.dados.margem_bruta}%</div><div style={{fontSize:'10px'}}>Lucro R${data.mais_rentavel.dados.lucro.toLocaleString()}</div></div>
              <div style={{background:'#1a1a2e', padding:'15px', borderRadius:'10px', borderLeft:'3px solid #fff'}}><div style={{fontSize:'10px', color:'#888'}}>LOCAL MAPA</div><div style={{fontSize:'12px', fontWeight:'bold'}}>{data.mercado.lat_click? `${data.mercado.lat_click.toFixed(4)}, ${data.mercado.lng_click.toFixed(4)}` : 'Cidade central'}</div><div style={{fontSize:'10px'}}>{data.cidade}</div></div>
            </div>

            <div style={{display:'flex', gap:'10px', marginTop:'20px', borderBottom:'1px solid #333', paddingBottom:'10px', flexWrap:'wrap'}}>
              {[{id:'financeira', label:'Viabilidade'}, {id:'cerebro', label:'Cérebro Construtor'}, {id:'mercado', label:'Mercado'}, {id:'mapa', label:'Mapa Resultado'}, {id:'marketing', label:'Marketing'}, {id:'executivo', label:'Executivo'}].map(t=>(
                <button key={t.id} onClick={()=>setAba(t.id)} style={{background: aba===t.id? '#8B5CF6' : '#1a1a2e', border:'none', color:'#fff', padding:'8px 14px', borderRadius:'6px', fontSize:'12px', cursor:'pointer'}}>{t.label}</button>
              ))}
            </div>

            {aba==='mapa' && (
              <div style={{background:'#1a1a2e', padding:'20px', borderRadius:'12px', marginTop:'15px'}}>
                <h3>Mapa Resultado - Centralizado em {data.cidade} + Local clicado + Concorrentes</h3>
                <div id="map-result" style={{height:'450px', borderRadius:'8px', background:'#0a0a12'}}></div>
              </div>
            )}
            {aba==='financeira' && (
              <div style={{background:'#1a1a2e', padding:'20px', borderRadius:'12px', marginTop:'15px'}}>
                <h3>Viabilidade - CUB + Material vs Venda</h3>
                <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'15px'}}>
                  {Object.entries(data.faixas).map(([k,v])=>(
                    <div key={k} style={{background:'#0a0a12', padding:'15px', borderRadius:'8px', border: data.mais_rentavel.faixa===k? '2px solid #D4AF37' : '1px solid #333'}}>
                      <b>{v.material.nome}</b><br/><small>{v.material.pisos}</small>
                      <div style={{marginTop:'10px', fontSize:'12px'}}>Custo m²: R${v.custo_m2}<br/>Venda m²: R${v.preco_m2}<br/>Margem: <b style={{color:'#10b981'}}>{v.margem_bruta}%</b><br/>Lucro: R${v.lucro.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aba==='executivo' && (
              <div style={{background:'#1a1a2e', padding:'20px', borderRadius:'12px', marginTop:'15px', borderLeft:'4px solid #D4AF37'}}>
                <h3>Painel Executivo</h3>
                <p>CUB: R${data.cub.valor} | Mais Rentável: {data.mais_rentavel.faixa} {data.mais_rentavel.dados.margem_bruta}% | Local Mapa: {data.mercado.lat_click}, {data.mercado.lng_click}</p>
                <button onClick={baixarHTML} style={{background:'#fff', color:'#000', border:'none', padding:'12px 20px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>Baixar HTML Executivo</button>
              </div>
            )}
            {aba==='cerebro' && <div style={{background:'#1a1a2e', padding:'20px', borderRadius:'12px', marginTop:'15px'}}><h3>Cérebro Construtor</h3><p>{data.cerebro_construtor.justificativa}</p><p>Material: {data.cerebro_construtor.material_sugerido.nome} - {data.cerebro_construtor.material_sugerido.pisos}</p><h4>ZoneGrid</h4>{data.zone_grid.map(z=><div key={z.zona} style={{display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #333', fontSize:'12px'}}><span>{z.zona}</span><span>{z.ocupacao}% | {z.sensorial} | R${z.ticket}</span></div>)}</div>}
            {aba==='mercado' && <div style={{background:'#1a1a2e', padding:'20px', borderRadius:'12px', marginTop:'15px'}}><h3>Mercado</h3><p>Ticket R${data.mercado.ticket_m2_venda_real} | IBGE Pop {data.ibge.populacao} | Renda R${data.ibge.renda_media}</p><ul>{data.concorrencia_real.map((c,i)=><li key={i}>{c}</li>)}</ul></div>}
            {aba==='marketing' && <div style={{background:'#1a1a2e', padding:'20px', borderRadius:'12px', marginTop:'15px'}}><h3>Marketing</h3><ol>{data.copies_elevation.map((c,i)=><li key={i} style={{margin:'8px 0', background:'#0a0a12', padding:'10px', borderRadius:'6px'}}>{c}</li>)}</ol><ol>{data.roteiros_drones.map((c,i)=><li key={i} style={{margin:'8px 0', color:'#D4AF37'}}>{c}</li>)}</ol></div>}
          </>
        )}
      </div>
    </div>
  )
}
createRoot(document.getElementById('root')).render(<App/>)
