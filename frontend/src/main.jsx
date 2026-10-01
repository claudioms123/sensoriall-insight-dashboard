
import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom/client'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const API = import.meta.env.VITE_API_URL || "https://sensoriall-backend.onrender.com"

function App(){
  const [token, setToken] = useState(localStorage.getItem('token')||'')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
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

  useEffect(()=>{
    if(!mapSelectRef.current || mapSelectInstance.current) return
    mapSelectInstance.current = L.map(mapSelectRef.current).setView([-15.79,-47.88], 4)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapSelectInstance.current)
    mapSelectInstance.current.on('click', async (e)=>{
      setLatClick(e.latlng.lat); setLngClick(e.latlng.lng)
      if(markerSelect.current) mapSelectInstance.current.removeLayer(markerSelect.current)
      markerSelect.current = L.marker([e.latlng.lat, e.latlng.lng]).addTo(mapSelectInstance.current).bindPopup(`Local<br>${e.latlng.lat.toFixed(5)}`).openPopup()
      try{
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${e.latlng.lat}&lon=${e.latlng.lng}&format=json`)
        const j = await r.json()
        if(j.display_name) setEndereco(j.display_name)
      }catch{}
    })
    setTimeout(()=> mapSelectInstance.current.invalidateSize(), 500)
  },[])

  useEffect(()=>{
    if(aba!=='mapa' || !data || !mapResultRef.current) return
    const lat = data.mercado.lat_click || data.mercado.lat
    const lng = data.mercado.lng_click || data.mercado.lng
    if(mapResultInstance.current) mapResultInstance.current.remove()
    mapResultInstance.current = L.map(mapResultRef.current).setView([lat,lng], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapResultInstance.current)
    L.marker([lat,lng]).addTo(mapResultInstance.current).bindPopup(`${data.cidade}`).openPopup()
    setTimeout(()=> mapResultInstance.current.invalidateSize(), 300)
  },[aba, data])

  const login = async ()=>{
    setMsg('Entrando...')
    try{
      // tenta 3 formatos comuns de login
      let r = await fetch(`${API}/auth/login`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: senha})})
      if(!r.ok){
        r = await fetch(`${API}/login`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: senha})})
      }
      if(!r.ok){
        const fd = new FormData()
        fd.append('username', email)
        fd.append('password', senha)
        r = await fetch(`${API}/auth/login`,{method:'POST', body: fd})
      }
      const j = await r.json()
      const tk = j.access_token || j.token || j.accessToken
      if(!r.ok || !tk) throw new Error(j.detail || j.msg || 'Login falhou')
      localStorage.setItem('token', tk)
      setToken(tk)
      setMsg('')
    }catch(e){ setMsg(e.message) }
  }

  const logout = ()=>{
    localStorage.removeItem('token')
    setToken('')
    setData(null)
  }

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
      if(!r.ok){
        if(r.status===401){ logout(); throw new Error('Sessão expirou, faça login de novo') }
        throw new Error(j.detail || 'Erro')
      }
      setData(j); setAba('viabilidade'); setMsg('')
    }catch(e){ setMsg(e.message) }
  }

  const [modo, setModo] = useState('login')
  const [debug, setDebug] = useState('')

  const registrar = async ()=>{
    setMsg('Cadastrando...'); setDebug('')
    try{
      let r = await fetch(`${API}/auth/register`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: senha})})
      if(!r.ok){
        r = await fetch(`${API}/register`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: senha})})
      }
      if(!r.ok){
        r = await fetch(`${API}/auth/signup`,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password: senha})})
      }
      const txt = await r.text()
      setDebug(`Status ${r.status}: ${txt}`)
      if(!r.ok) throw new Error(`Erro ${r.status}: ${txt}`)
      setMsg('Cadastrado! Agora clique em Entrar')
      setModo('login')
    }catch(e){ setMsg(e.message) }
  }

  if(!token){
    return (
      <div style={{background:'#0a0a12', color:'#fff', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter'}}>
        <div style={{background:'#151525', padding:'30px', borderRadius:'12px', width:'400px'}}>
          <h3 style={{marginTop:0}}>Sensoriall - {modo==='login'?'Login':'Criar Conta'}</h3>
          <div style={{display:'flex', gap:'8px', marginBottom:'12px'}}>
            <button onClick={()=>setModo('login')} style={{flex:1, padding:'8px', background: modo==='login'?'#8a5cf5':'#222', border:'none', color:'#fff', borderRadius:'6px'}}>Entrar</button>
            <button onClick={()=>setModo('cadastro')} style={{flex:1, padding:'8px', background: modo==='cadastro'?'#8a5cf5':'#222', border:'none', color:'#fff', borderRadius:'6px'}}>Cadastrar</button>
          </div>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Seu email" style={{width:'100%', padding:'10px', marginTop:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <input type="password" value={senha} onChange={e=>setSenha(e.target.value)} placeholder="Senha (min 6)" style={{width:'100%', padding:'10px', marginTop:'8px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          {modo==='login' ? (
            <button onClick={login} style={{width:'100%', marginTop:'12px', background:'#8a5cf5', padding:'12px', borderRadius:'8px', border:'none', color:'#fff', fontWeight:'bold', cursor:'pointer'}}>Entrar</button>
          ) : (
            <button onClick={registrar} style={{width:'100%', marginTop:'12px', background:'#00ff88', padding:'12px', borderRadius:'8px', border:'none', color:'#000', fontWeight:'bold', cursor:'pointer'}}>Cadastrar Novo</button>
          )}
          {msg && <div style={{color: msg.includes('Cadastrado')?'#00ff88':'tomato', fontSize:'12px', marginTop:'8px', wordBreak:'break-all'}}>{msg}</div>}
          {debug && <div style={{background:'#000', padding:'8px', marginTop:'8px', fontSize:'10px', color:'#888', borderRadius:'4px', maxHeight:'100px', overflowY:'auto'}}>{debug}</div>}
          <small style={{color:'#666', display:'block', marginTop:'12px'}}>Backend: {API}</small>
        </div>
      </div>
    )
  }

  return (
    <div style={{background:'#0a0a12', color:'#fff', minHeight:'100vh', padding:'15px', fontFamily:'Inter'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
        <small style={{color:'#888'}}>Logado | <span onClick={logout} style={{color:'#8a5cf5', cursor:'pointer', textDecoration:'underline'}}>Sair</span></small>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
        <div style={{background:'#151525', padding:'15px', borderRadius:'12px'}}>
          <b>1. Busca, Orçamento e Mapa - Clique no mapa para escolher</b><br/>
          <small style={{color:'#888'}}>Digite OU clique no mapa ao lado</small>
          <input value={cidade} onChange={e=>setCidade(e.target.value)} placeholder="Brasília" style={{width:'100%', marginTop:'10px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
          <input value={endereco} onChange={e=>setEndereco(e.target.value)} placeholder="Endereço (auto ao clicar)" style={{width:'100%', marginTop:'8px', padding:'10px', borderRadius:'6px', background:'#000', color:'#fff', border:'1px solid #333'}}/>
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
        </div>
        <div style={{background:'#151525', borderRadius:'12px', overflow:'hidden'}}>
          <div style={{padding:'8px', fontSize:'10px', color:'#888'}}>MAPA - CLIQUE PARA ESCOLHER</div>
          <div ref={mapSelectRef} style={{height:'300px'}}></div>
        </div>
      </div>

      {data && (
        <>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginTop:'15px'}}>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #D4AF37'}}><small>CUB REAL</small><br/><b>R${data.cub.valor}</b><br/><small>{data.cub.fonte}</small></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #8a5cf5'}}><small>TICKET REAL</small><br/><b>R${data.mercado.ticket}/m²</b><br/><small>{data.cidade}</small></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #00ff88'}}><small>MAIS RENTÁVEL</small><br/><b>{data.mais_rentavel.faixa} {data.mais_rentavel.dados.margem_bruta}%</b><br/><small>Lucro R${data.mais_rentavel.dados.lucro.toLocaleString('pt-BR')}</small></div>
            <div style={{background:'#1a1a2e', padding:'12px', borderRadius:'8px', borderLeft:'3px solid #fff'}}><small>LOCAL</small><br/><b>{latClick? 'Pino':'Central'}</b><br/><small>{data.cidade}</small></div>
          </div>

          <div style={{display:'flex', gap:'8px', marginTop:'15px', flexWrap:'wrap'}}>
            {['viabilidade','mercado','mapa','marketing'].map(t=>(
              <button key={t} onClick={()=>setAba(t)} style={{padding:'6px 12px', borderRadius:'6px', background: aba===t? '#8a5cf5':'#222', color:'#fff', border:'none', cursor:'pointer'}}>{t}</button>
            ))}
          </div>

          {aba==='viabilidade' && (
            <div style={{marginTop:'15px', background:'#151525', padding:'15px', borderRadius:'12px'}}>
              <b>Viabilidade - PACOTE 10 ITENS (Porcelanato dentro do pacote)</b>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'12px'}}>
                {Object.entries(data.faixas).map(([k,v])=>(
                  <div key={k} style={{background:'#0a0a12', padding:'15px', borderRadius:'8px', border: data.mais_rentavel.faixa===k? '2px solid #D4AF37':'1px solid #333'}}>
                    <b style={{color: data.mais_rentavel.faixa===k? '#D4AF37':'#fff'}}>{v.material.nome}</b><br/><small>{v.material.pisos}</small>
                    <div style={{marginTop:'8px', fontSize:'12px'}}>
                      <div>Custo m²: R${v.custo_m2}</div>
                      <div>Venda m²: R${v.preco_m2}</div>
                      <div>Margem: {v.margem_bruta}%</div>
                      <div>Lucro: R${v.lucro.toLocaleString('pt-BR')}</div>
                    </div>
                    <div style={{marginTop:'12px', background:'#000', padding:'10px', borderRadius:'6px', maxHeight:'200px', overflowY:'auto', border:'1px solid #222'}}>
                      <b style={{fontSize:'10px', color:'#D4AF37'}}>PACOTE 10 ITENS:</b>
                      {v.pacote_detalhado?.map((it,i)=><div key={i} style={{fontSize:'10px', color:'#aaa', padding:'3px 0', borderBottom:'1px solid #111'}}>{it}</div>)}
                    </div>
                  </div>
                ))}
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
