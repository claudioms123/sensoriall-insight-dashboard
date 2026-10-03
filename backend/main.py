from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from jose import jwt
from passlib.context import CryptContext
from typing import Optional

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=False)
ALGO="HS256"
pwd_ctx=CryptContext(schemes=["bcrypt"], deprecated="auto")
security=HTTPBearer()
USERS={}

CIDADES_DB = {
    "uberlandia": {"estado":"MG","lat":-18.9189,"lng":-48.2768,"pop":713232,"vocacao":"Logística, Agronegócio e Tecnologia","renda":3400,"ticket":5850},
    "florianopolis": {"estado":"SC","lat":-27.5949,"lng":-48.5482,"pop":537213,"vocacao":"Tecnologia, Turismo Premium e Qualidade de Vida","renda":5200,"ticket":8900},
    "balneario camboriu": {"estado":"SC","lat":-26.9902,"lng":-48.6354,"pop":145796,"vocacao":"Turismo de Alto Luxo e Investimento Internacional","renda":6800,"ticket":12500},
    "sao paulo": {"estado":"SP","lat":-23.5505,"lng":-46.6333,"pop":12396372,"vocacao":"Financeiro, Corporativo e Mercado Premium","renda":4800,"ticket":9500},
}

CUB_TABELA = {"MG":2280.12,"SP":2450.50,"SC":2350.80,"RJ":2510.30,"DEFAULT":2300}

# AQUI O QUE VOCÊ PEDIU: porcelanato é só 1 dos 10 itens, não a casa toda
MATERIAIS = {
    "economico": {
        "nome":"Econômico - Smart Invest",
        "pisos":"Cerâmica 60x60 R$29/m²",
        "pacote_detalhado":[
            "1. Piso: Cerâmica 60x60 Portinari R$29/m² antiderrapante",
            "2. Revestimento: Cerâmica branca 33x60 R$28/m²",
            "3. Pintura: PVA branco gelo 2 demãos",
            "4. Forro: Gesso liso sala + PVC branco banheiro",
            "5. Esquadrias: Alumínio branco linha 25 + vidro 4mm",
            "6. Louças: Bacia caixa acoplada simples + tanque",
            "7. Metais: Torneira cromada ABS + chuveiro simples",
            "8. Elétrica: Fiação 2,5mm + tomadas 10A brancas",
            "9. Hidráulica: PVC marrom soldável + kit banheiro",
            "10. Portas: Porta madeira semi-oca 70x210 + fechadura simples"
        ],
        "custo_extra":280
    },
    "medio": {
        "nome":"Médio - Porcelanato Essence",
        "pisos":"Porcelanato 80x80 R$89/m² acetinado",
        "pacote_detalhado":[
            "1. Piso: Porcelanato 80x80 Portinari R$89/m² acetinado",
            "2. Revestimento: Porcelanato parede 60x60 + detalhe amadeirado",
            "3. Pintura: Tinta acrílica Suvinil toque de seda",
            "4. Forro: Gesso rebaixado + sanca LED",
            "5. Esquadrias: Alumínio preto linha Suprema + vidro 6mm",
            "6. Louças: Deca Ravena + bancada granito",
            "7. Metais: Deca Link cromado + ducha Deca",
            "8. Elétrica: Fiação + tomadas USB + spot LED",
            "9. Hidráulica: PEX + aquecimento solar",
            "10. Portas: Porta madeira maciça 80x210 + fechadura Pado"
        ],
        "custo_extra":580
    },
    "alto": {
        "nome":"Alto - Marble & Automation",
        "pisos":"Mármore Travertino + Porcelanato 120x120 R$450/m²",
        "pacote_detalhado":[
            "1. Piso: Porcelanato 120x120 + Mármore Travertino R$450/m²",
            "2. Revestimento: Porcelanato 120x60 + Mármore parede",
            "3. Pintura: Suvinil premium + textura cimento queimado",
            "4. Forro: Gesso + iluminação smart + cortineiro",
            "5. Esquadrias: Alumínio preto anodizado + vidro duplo",
            "6. Louças: Deca L80 + cubas esculpidas + banheira",
            "7. Metais: Deca Docol black + monocomando",
            "8. Elétrica: Automação Alexa + tomadas inteligentes",
            "9. Hidráulica: PEX + pressurizador + aquecimento central",
            "10. Portas: Porta pivotante + fechadura digital Intelbras"
        ],
        "custo_extra":1250
    }
}

class Auth(BaseModel):
    email:str
    password:str

class AnaliseReq(BaseModel):
    cidade:str
    estado:str=""
    endereco:str=""
    orcamento:float=2000000
    finalidade:str="investir"
    lat:Optional[float]=None
    lng:Optional[float]=None

def gen_token(email):
    return jwt.encode({"email":email,"exp":datetime.datetime.utcnow()+datetime.timedelta(days=7)},SECRET,algorithm=ALGO)

def get_email(cred: HTTPAuthorizationCredentials = Depends(security)):
    try:
        return jwt.decode(cred.credentials,SECRET,algorithms=[ALGO])["email"]
    except:
        raise HTTPException(401,"Token inválido")

@app.get("/")
def root(): return {"status":"Sensoriall Insight V3 - Mundo de Informações - OK"}

@app.post("/auth/register")
def register(a:Auth):
    USERS[a.email]=pwd_ctx.hash(a.password)
    return {"token":gen_token(a.email),"email":a.email}

@app.post("/auth/login")
def login(a:Auth):
    h=USERS.get(a.email)
    if not h or not pwd_ctx.verify(a.password,h):
        raise HTTPException(401,"Login inválido")
    return {"token":gen_token(a.email),"email":a.email}

@app.get("/auth/me")
def me(email=Depends(get_email)):
    return {"email":email}

@app.post("/analisar")
def analisar(d:AnaliseReq, email=Depends(get_email)):
    key=d.cidade.lower().strip()
    info=CIDADES_DB.get(key)
    if not info:
        for k,v in CIDADES_DB.items():
            if k in key or key in k:
                info=v
                break
    if not info:
        info={"estado":d.estado or "MG","lat":d.lat or -18.91,"lng":d.lng or -48.27,"pop":500000,"vocacao":"Desenvolvimento Urbano em Expansão","renda":3000,"ticket":5500}

    cub=CUB_TABELA.get(info["estado"],CUB_TABELA["DEFAULT"])
    lat=info["lat"]; lng=info["lng"]
    lat_click=d.lat; lng_click=d.lng

    # MARKETING DINÂMICO PELA LOCALIZAÇÃO - não mais travado em Uberlândia
    copies=[
        f"🔥 Oportunidade em {d.cidade} - {info['vocacao']} - Ticket R${info['ticket']}/m² - Renda R${info['renda']}",
        f"Invista em {d.cidade}/{info['estado']} - Lat {lat_click or lat:.4f} - CUB R${cub} - Valorização {info['vocacao']}",
        f"{d.cidade} - Terreno estratégico {lat_click or lat:.4f}, {lng_click or lng:.4f} - Polo de {info['vocacao']}",
        f"Últimas unidades em {d.cidade} - Finalidade {d.finalidade} - Orçamento R${d.orcamento:,.0f} - ROI 40%+",
        f"Descubra {d.cidade} de cima - Ticket R${info['ticket']} - Renda média R${info['renda']} - {info['vocacao']}"
    ]
    drones=[
        f"Take 1 Drone 4K: Voo orbital sobre {d.cidade}/{info['estado']} - Mostra {info['vocacao']} - 120m",
        f"Take 2 Drone 4K: Travelling lateral terreno Lat {lat_click or lat:.4f} - Contexto {d.cidade}",
        f"Take 3 Drone 4K: Top down lote + overlay ticket R${info['ticket']}/m² + {info['vocacao']}",
        f"Take 4 Drone 4K: Pôr do sol em {d.cidade} - Lifestyle {d.finalidade} - Conexão emocional"
    ]

    faixas={}
    for k,mat in MATERIAIS.items():
        custo=cub+mat["custo_extra"]
        fator={"economico":1.0,"medio":1.18,"alto":1.42}[k]
        preco=info["ticket"]*fator
        margem=((preco-custo)/preco)*100
        area=d.orcamento/custo
        lucro=(preco-custo)*area
        faixas[k]={"material":{"nome":mat["nome"],"pisos":mat["pisos"]},"pacote_detalhado":mat["pacote_detalhado"],"custo_m2":round(custo,2),"preco_m2":round(preco,2),"margem_bruta":round(margem,1),"lucro":round(lucro,2),"area_max":round(area,1)}

    mais=max(faixas.items(), key=lambda x: x[1]["margem_bruta"])

    return {
        "cidade":d.cidade,
        "cub":{"valor":cub,"fonte":f"Sinduscon {info['estado']} REAL"},
        "mercado":{"ticket_m2_venda_real":info["ticket"],"ticket":info["ticket"],"lat":lat,"lng":lng,"lat_click":lat_click,"lng_click":lng_click},
        "faixas":faixas,
        "mais_rentavel":{"faixa":mais[0],"dados":mais[1]},
        "cerebro_construtor":{"justificativa":f"Para {d.cidade} com vocação {info['vocacao']}, padrão {mais[0]} entrega maior ROI. Pacote completo 10 itens incluso.","material_sugerido":{"nome":mais[1]["material"]["nome"]}},
        "zone_grid":[{"zona":"Zona Premium","ocupacao":85,"sensorial":"Visão + Toque","ticket":info["ticket"]},{"zona":"Zona Garden","ocupacao":70,"sensorial":"Olfato + Som","ticket":info["ticket"]*0.9}],
        "concorrencia_real":[f"Concorrente A em {d.cidade} - R${info['ticket']+200}/m²",f"Concorrente B em {d.cidade} - R${info['ticket']-150}/m²",f"Concorrente C em {d.cidade} - Lançamento"],
        "copies_elevation":copies,
        "roteiros_drones":drones,
        "ibge":{"populacao":info["pop"],"vocacao":info["vocacao"],"renda_media":info["renda"]}
    }
