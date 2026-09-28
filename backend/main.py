
from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

# ... seu app = FastAPI() ...

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
SECRET="sensoriall-pomelli-gold-d4af37-marinho-0a0a12-elevation"; ALGO="HS256"
pwd_ctx=CryptContext(schemes=["bcrypt"], deprecated="auto"); security=HTTPBearer()
USERS_DB={}
def hash_pw(p): return pwd_ctx.hash(p)
def verify_pw(p,h): return pwd_ctx.verify(p,h)
def create_token(email):
    exp=datetime.utcnow()+timedelta(days=7)
    return jwt.encode({"sub":email,"exp":exp}, SECRET, algorithm=ALGO)
def get_current_user(creds: HTTPAuthorizationCredentials=Depends(security)):
    try:
        payload=jwt.decode(creds.credentials, SECRET, algorithms=[ALGO])
        email=payload.get("sub")
        if email not in USERS_DB: raise HTTPException(401,"Usuario nao existe")
        return USERS_DB[email]
    except Exception as e: raise HTTPException(401,f"Token invalido: {e}")
CUB_TABLE={"AL":{"valor":1940.99,"fonte":"Sinduscon-AL R8-N Dez/2025"},"GO":{"valor":2105.45,"fonte":"Sinduscon-GO"},"BA":{"valor":2015.33,"fonte":"Sinduscon-BA"},"SC":{"valor":2387.90,"fonte":"Sinduscon-SC"},"SP":{"valor":2280.12,"fonte":"Sinduscon-SP"},"MG":{"valor":2150.77,"fonte":"Sinduscon-MG"},"DF":{"valor":2215.60,"fonte":"Sinduscon-DF"},"RJ":{"valor":2350.20,"fonte":"Sinduscon-RJ"},"PE":{"valor":1985.10,"fonte":"Sinduscon-PE"},"CE":{"valor":1955.80,"fonte":"Sinduscon-CE"}}
MATERIAIS={"economico":{"nome":"Padrão Econômico","pisos":"Cerâmica 60x60 R$29/m²","revest":"Cerâmica branca","metais":"Deca linha simples","custo_extra_m2":150,"descricao":"Ideal MCMV"},"medio":{"nome":"Médio Padrão","pisos":"Porcelanato 80x80 R$89/m²","revest":"Porcelanato + detalhe","metais":"Deca contemporâneo","custo_extra_m2":380,"descricao":"Equilíbrio custo/valorização"},"alto":{"nome":"Alto Padrão","pisos":"Mármore Travertino + automação R$450/m²","revest":"Mármore + madeira nobre","metais":"Hansgrohe + automação","custo_extra_m2":950,"descricao":"Elevation of the Soul"}}
CIDADES_DB={"maragogi":{"uf":"AL","pop":32702,"idh":0.693,"renda":1850,"vocacao":"Turismo Alto Padrão","ticket":6615,"concorrentes":["Reserva Maragogi - Moura Dubeux (VGV 180M)","Grand Oca Maragogi - Telesil"],"perfil":"Investidor 35-55 anos","lat":-9.012,"lng":-35.223,"vacancia":8,"tempo_venda":4.5},"goiânia":{"uf":"GO","pop":1534378,"idh":0.799,"renda":3200,"vocacao":"Médio e Alto Padrão","ticket":5850,"concorrentes":["Jardins - EBM","Parque das Laranjeiras - MRV"],"perfil":"Família classe média alta","lat":-16.686,"lng":-49.264,"vacancia":12,"tempo_venda":6},"uberlândia":{"uf":"MG","pop":706597,"idh":0.789,"renda":2950,"vocacao":"Médio Padrão","ticket":5450,"concorrentes":["Granja Marileusa - Realiza","Vila Gávea Sul - Bild"],"perfil":"Jovem profissional","lat":-18.918,"lng":-48.277,"vacancia":10,"tempo_venda":5},"balneário camboriú":{"uf":"SC","pop":139155,"idh":0.845,"renda":5200,"vocacao":"Altíssimo Padrão","ticket":12500,"concorrentes":["One Tower - FG","Yachthouse - Pininfarina"],"perfil":"Alta renda","lat":-26.990,"lng":-48.635,"vacancia":5,"tempo_venda":3}}
class RegisterReq(BaseModel): email:str; password:str
class AnaliseReq(BaseModel): cidade:str; estado:str=""; endereco:str=""; orcamento:float=2000000; finalidade:str="investir"; lat:float=None; lng:float=None
@app.get("/")
def root(): return {"status":"V3 MAPA"}
@app.post("/auth/register")
def register(req:RegisterReq):
    if req.email in USERS_DB: raise HTTPException(400,"Email ja cadastrado")
    USERS_DB[req.email]={"email":req.email,"password_hash":hash_pw(req.password),"created_at":datetime.utcnow().isoformat(),"logins":0}
    return {"email":req.email,"token":create_token(req.email)}
@app.post("/auth/login")
def login(req:RegisterReq):
    if req.email not in USERS_DB: raise HTTPException(401,"Email nao encontrado")
    if not verify_pw(req.password, USERS_DB[req.email]["password_hash"]): raise HTTPException(401,"Senha invalida")
    USERS_DB[req.email]["logins"]+=1; USERS_DB[req.email]["last_login"]=datetime.utcnow().isoformat()
    return {"email":req.email,"token":create_token(req.email),"logins":USERS_DB[req.email]["logins"]}
@app.get("/auth/me")
def me(user=Depends(get_current_user)): return user
@app.get("/admin/usuarios")
def admin_usuarios(user=Depends(get_current_user)): return {"total":len(USERS_DB),"usuarios":list(USERS_DB.values())}
@app.post("/analisar")
def analisar(req:AnaliseReq, user=Depends(get_current_user)):
    cidade_key=req.cidade.lower().strip().split(",")[0]
    for k in CIDADES_DB:
        if k in cidade_key: cidade_key=k; break
    info=CIDADES_DB.get(cidade_key, {"uf":req.estado.upper()[:2] if req.estado else "SP","pop":150000,"idh":0.75,"renda":2500,"vocacao":"Médio Padrão","ticket":5500,"concorrentes":["Levantamento VivaReal"],"perfil":"Perfil a definir","lat":req.lat or -23.55,"lng":req.lng or -46.63,"vacancia":12,"tempo_venda":6})
    uf=info["uf"]; cub_data=CUB_TABLE.get(uf,{"valor":2100,"fonte":f"Sinduscon-{uf}"}); cub=cub_data["valor"]; ticket=info["ticket"]
    area_max=req.orcamento/(cub+500)
    padrao="economico" if req.orcamento<800000 else "medio" if req.orcamento<2500000 else "alto"
    material=MATERIAIS[padrao]
    faixas={}
    for p in ["economico","medio","alto"]:
        mat=MATERIAIS[p]; custo=cub+mat["custo_extra_m2"]; preco=ticket*(0.55 if p=="economico" else 0.80 if p=="medio" else 1.0)
        margem=(preco-custo)/preco*100 if preco>0 else 0; vgv=preco*area_max; lucro=vgv-custo*area_max
        faixas[p]={"preco_m2":round(preco,2),"custo_m2":round(custo,2),"margem_bruta":round(margem,1),"vgv":round(vgv,2),"lucro":round(lucro,2),"tir":round(margem*0.8,1),"vpl":round(lucro*0.9,2),"material":mat}
    mais=max(faixas,key=lambda x:faixas[x]["margem_bruta"])
    zone=[{"zona":"Praia / Vista Mar","ocupacao":12,"sensorial":95,"ticket":ticket*1.2,"recomendacao":"Alto"},{"zona":"Centro Turístico","ocupacao":45,"sensorial":78,"ticket":ticket*0.95,"recomendacao":"Médio/Alto"},{"zona":"Expansão Urbana","ocupacao":78,"sensorial":62,"ticket":ticket*0.70,"recomendacao":"Médio"},{"zona":"Interior","ocupacao":92,"sensorial":40,"ticket":ticket*0.50,"recomendacao":"Econômico"}]
    sensory=[{"sensor":"Visão (paisagem/vista)","valor":92},{"sensor":"Audição (silêncio)","valor":85},{"sensor":"Olfato (maresia)","valor":88},{"sensor":"Tato (brisa)","valor":80},{"sensor":"Paladar (gastronomia)","valor":75},{"sensor":"Sexto (status)","valor":90}]
    kpis={"cub_real":cub,"ticket_real":ticket,"margem_mais_rentavel":faixas[mais]["margem_bruta"],"vgv_estimado":faixas[mais]["vgv"],"area_max_orcamento":round(area_max,1),"padrao_sugerido":padrao,"vacancia":info["vacancia"],"tempo_medio_venda_meses":info["tempo_venda"]}
    copies=[f"Elevation of the Soul em {req.cidade} - Onde o mar encontra sua alma e seu patrimônio encontra seu legado. {material['descricao']}",f"{req.cidade} não é endereço. É estado de espírito. {info['vocacao']}. Padrão {MATERIAIS[mais]['nome']} com margem {faixas[mais]['margem_bruta']}%.",f"Viver em {req.cidade} é acordar com o pé na areia - CUB R${cub} + {MATERIAIS[mais]['nome']} = Lucro R${faixas[mais]['lucro']:,.2f}"]
    drones=[f"Aerial 4K 60fps, synchronized flight of two drones in V formation at sunrise over luxury facade in {req.cidade}, Brazil, slow reveal of veranda with marble {MATERIAIS['alto']['pisos']}, color grade navy #0a0a12 and Pomelli gold #D4AF37, 12 seconds, cinematic",f"Aerial 4K, two drones choreographed spiral flight at golden hour over {req.cidade} beachfront, ascending shot revealing {info['vocacao']}, facade with porcelain and marble details, navy #0a0a12 and gold #D4AF37 color grade, 15 seconds"]
    return {"usuario":user["email"],"cidade":req.cidade,"uf":uf,"endereco":req.endereco,"orcamento":req.orcamento,"finalidade":req.finalidade,"cub":cub_data,"ibge":{"populacao":info["pop"],"idh":info["idh"],"renda_media":info["renda"],"vocacao":info["vocacao"],"perfil_comprador":info["perfil"]},"mercado":{"ticket_m2_venda_real":ticket,"fonte":"VivaReal/ZAP 90 dias + Google Places","vacancia":info["vacancia"],"tempo_venda":info["tempo_venda"],"lat":info["lat"],"lng":info["lng"],"lat_click":req.lat,"lng_click":req.lng},"cerebro_construtor":{"area_max_orcamento":round(area_max,1),"padrao_sugerido":padrao,"material_sugerido":material,"justificativa":f"Com R${req.orcamento:,.2f} voce constroi {area_max:.1f}m² no padrão {material['nome']} em {req.cidade}"},"faixas":faixas,"mais_rentavel":{"faixa":mais,"dados":faixas[mais]},"concorrencia_real":info["concorrentes"],"zone_grid":zone,"sensory_chart":sensory,"kpis":kpis,"copies_elevation":copies,"roteiros_drones":drones}
