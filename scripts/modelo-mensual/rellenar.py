# Rellena el Modelo Mensual con escenarios INVENTADOS y vuelca libro + entrada a JSON.
import sys
import openpyxl, json, re, datetime as dt, calendar
sys.stdout.reconfigure(encoding='utf-8')
XLSX = sys.argv[1]; SALIDA = sys.argv[2]
PRENDAS = ['Sábana personal','Sábana king','Funda de almohada','Toalla de baño','Toalla de mano','Toalla alfombra','Toalla facial','Toalla de piscina']
UBIC = ['Lavandería (en proceso)','Almacén de sucio','Almacén de limpio','Piso 24','Office piso 24','Piso 25','Office piso 25','Piso 26','Office piso 26','Spa 1','Spa 2']
AREAS = ['Secado','Planchado','Doblado','Control final']
def serial(iso): return (dt.date.fromisoformat(iso) - dt.date(1899,12,30)).days
def hora(h):
    H,M = h.split(':'); return (int(H)*60+int(M))/1440
def lav(f,t,v,p,r,i,l,k,op='Op A',eq='Lav 1',ob=''): return dict(fecha=f,turno=t,vale=v,prenda=p,recibidas=r,pendiente_inicial=i,lavadas=l,kg=k,operario=op,equipo=eq,observaciones=ob)
def pro(f,t,a,v,p,d,hi,hf,c,m1,m2,m3,m4,ro,pe,eq='Sec 1',ops='Op B',jefe='Jefe',ob=''): return dict(fecha=f,turno=t,area=a,equipo=eq,operarios=ops,jefe_turno=jefe,vale=v,prenda=p,declaradas=d,hora_inicio=hi,hora_fin=hf,conforme=c,m_rosa=m1,m_negra=m2,m_oxido=m3,m_otras=m4,roturas=ro,pendientes=pe,observaciones=ob)
def jor(tu,en,hp,ht,pa,ci,ob=''): return dict(turistas=tu,entregadas=en,horas_previstas=hp,horas_trabajadas=ht,parada=pa,observacion=ob,cierre=ci)
def inc(f,c,d,e,im='No',fc=None,pa='P1'): return dict(fecha=f,causa=c,duracion=d,impacto='Impacto',accion='Accion',responsable='R',fecha_cierre=fc,estado=e,imputable=im,parte=pa)
def equ(n,t,o): return dict(id=n,nombre=n,total=t,operativos=o,estado_causa='',intervencion='',pendiente='',responsable='',fecha_prevista=None,parte='')
def man(ta,ti,fp,fe): return dict(tarea=ta,equipo='E',tipo=ti,fecha_planificada=fp,fecha_ejecutada=fe,trabajo='',pendiente='',responsable='',proxima=None,documento='')
def ret(f,c,q,pr,mo,co,ac,fa='Pendiente'): return dict(fecha=f,concepto=c,prendas='Toalla',cantidad=q,causa='',responsabilidad='',precio=pr,moneda=mo,conciliado=co,acta=ac,facturacion=fa)
def acc(f,a,fl,e): return dict(fecha=f,origen='O',accion=a,responsable='R',fecha_limite=fl,estado=e,resultado='',acta='')
def con(f,u,vals,ob=''): return dict(fecha=f,ubicacion=u,valores=dict(zip(PRENDAS,vals)),observacion=ob)

def esc_borde():
    m='2026-10-'
    L=[lav(m+'01','Día','V1',PRENDAS[0],120,0,120,90.0),lav(m+'01','Día','V1',PRENDAS[2],180,0,170,28.9),lav(m+'01','Noche','V2',PRENDAS[3],140,12,152,92.7),
       lav(m+'02','Día','V3',PRENDAS[4],200,0,205,55.0),lav(m+'02','Día','V3',PRENDAS[5],90,0,90,None),lav(m+'02','Día','V3',PRENDAS[7],60,0,0,0),
       lav(m+'03','Día','V4',PRENDAS[0],50,0,50,0),lav(m+'03','Día','V4',PRENDAS[1],10,0,0,3.5),
       lav(m+'04','Día','V5',PRENDAS[0],40,0,40,30.0),
       lav(m+'06','Día','V6',PRENDAS[0],30,0,30,22.5),
       lav(m+'08','Día','V7',PRENDAS[0],25,5,30,20.0),
       lav('2026-11-01','Día','V8',PRENDAS[0],25,0,25,20.0),
       lav(m+'10','','V9',PRENDAS[0],25,0,25,20.0),lav(m+'10','Día','',PRENDAS[0],25,0,25,20.0)]
    J={m+'01':jor(600,1500,16,15.5,0.5,'Cerrado'),m+'02':jor(610,1400,16,16,0,'Cerrado'),m+'03':jor(0,0,16,0,0,'Cerrado'),m+'04':jor(620,None,16,None,None,'Pendiente'),
       m+'05':jor(630,1300,16,16,0,'Cerrado'),m+'06':jor(640,1200,16,16,0,'Sin actividad'),m+'07':jor(650,0,0,0,0,'Sin actividad'),m+'08':jor(None,None,None,None,None,'Pendiente'),m+'10':jor(1,1,1,1,1,'Cerrado')}
    P=[pro(m+'01','Día','Secado','V1',PRENDAS[0],120,'08:10','09:40',118,1,0,0,0,1,0),pro(m+'01','Día','Secado','V1',PRENDAS[2],170,'08:10','09:40',170,0,0,0,0,0,0),
       pro(m+'01','Día','Secado','V1',PRENDAS[3],152,'23:30','01:00',140,3,1,0,0,2,4),pro(m+'01','Noche','Planchado','V2',PRENDAS[3],100,'','',None,0,0,0,0,0,0),
       pro(m+'02','Día','Doblado','V3',PRENDAS[4],200,'10:00','11:00',190,2,2,2,2,2,0),pro('2026-11-02','Día','Doblado','V3',PRENDAS[4],10,'10:00','11:00',10,0,0,0,0,0,0),
       pro(m+'02','','Doblado','V3',PRENDAS[5],10,'10:00','11:00',10,0,0,0,0,0,0)]
    C=[con(m+'01','Piso 24',[70,18,40,46,44,40,9,100]),con(m+'01','Almacén de sucio',[45,None,60,None,None,None,None,None]),
       con(m+'05','Piso 24',[60,None,None,None,None,None,None,None]),con(m+'05','Spa 1',[0,0,0,0,0,0,0,0]),
       con(m+'03','Piso 25',[10,None,None,None,None,None,None,None]),con(m+'03','Piso 25',[11,12,None,None,None,None,None,None])]
    I=[inc(m+'02','Agua',4.0,'Cerrada',fc=m+'03'),inc(m+'12','Agua',2.5,'Abierta'),inc(m+'14','Electricidad',None,'En seguimiento'),inc(m+'15','Vapor',3,'Cerrada',fc=m+'16'),inc('2026-11-03','Agua',9,'Cerrada')]
    E=[equ('Lavadoras',4,4),equ('Secadoras',3,2),equ('Calandras',2,3)]
    MA=[man('Filtros','Preventivo',m+'05',m+'05'),man('Correas','Preventivo',m+'20',None),man('Motor','Correctivo',m+'21',m+'22'),man('Bomba','Preventivo','2026-11-05',m+'30'),man('Tarde','Preventivo',m+'25','2026-11-02')]
    R=[ret(m+'08','Retiro',20,None,'',  'Sí','A1','No procede'),ret(m+'15','Faltante',6,12.0,'USD','No','','Pendiente'),ret(m+'22','Mal uso',4,9.0,'USD','Sí','A2','Facturado'),ret(m+'23','Mal uso',2,100,'CUP','Sí','','Pendiente'),ret(m+'24','Otro ajuste',1,5,'EUR','No','','Pendiente'),ret('2026-11-01','Retiro',99,1,'USD','Sí','A3')]
    A=[acc(m+'02','Revisar tuberías',m+'15','Cerrada'),acc(m+'12','Aviso previo',m+'20','En curso'),acc(m+'24','Dosificación',m+'31','En curso'),acc(m+'25','Sin plazo',None,'Pendiente'),acc('2026-11-02','Fuera',m+'01','Pendiente')]
    return dict(nombre='borde',anio=2026,mes=10,lavado=L,jornadas=J,procesado=P,conteos=C,incidencias=I,equipos=E,mantenimiento=MA,retiros=R,acciones=A,
      pactadas=dict(zip(PRENDAS,[500,120,300,350,350,340,70,780])),revision=dict(operacion='Pendiente',kpi='Pendiente',incidencias='Pendiente',equipos='Validado',retiros='Pendiente',acciones='Pendiente'),
      datos=dict(representante='Rep',cargo='',fecha_elaboracion=''),)

def esc_completo():
    # Febrero: 28 días, todo cerrado y todas las ubicaciones contadas.
    anio,mes=2026,2; dias=calendar.monthrange(anio,mes)[1]
    L=[];J={};P=[]
    for d in range(1,dias+1):
        f=f'{anio}-{mes:02d}-{d:02d}'
        L.append(lav(f,'Día',f'V{d}',PRENDAS[0],100+d,0,100+d,70.5+d))
        L.append(lav(f,'Noche',f'W{d}',PRENDAS[1],50,d,50,33.25))
        J[f]=jor(500+d,140+d,16,15,1,'Cerrado')
        P.append(pro(f,'Día',AREAS[d%4],f'V{d}',PRENDAS[0],100,'06:00','07:30',95,1,1,1,1,1,0))
    f0=f'{anio}-{mes:02d}-01'; f1=f'{anio}-{mes:02d}-20'
    C=[]
    for i,u in enumerate(UBIC):
        C.append(con(f0,u,[10+i,5,5,5,5,5,5,5]))
        C.append(con(f1,u,[12+i,5,None,5,5,5,5,0]))
    pact=dict(zip(PRENDAS,[10*11+0,55,55,55,55,55,55,1]))
    return dict(nombre='completo',anio=anio,mes=mes,lavado=L,jornadas=J,procesado=P,conteos=C,incidencias=[inc(f0,'Electricidad',1.25,'Cerrada',fc=f0)],equipos=[equ('Lavadoras',4,3)],
      mantenimiento=[man('Filtros','Preventivo',f0,f0)],retiros=[ret(f0,'Faltante',1,2.5,'EUR','Sí','A')],acciones=[acc(f0,'Una',f'{anio}-{mes:02d}-28','En curso')],pactadas=pact,
      revision=dict(operacion='Validado',kpi='Validado',incidencias='Validado',equipos='Validado',retiros='Validado',acciones='Validado'),datos=dict(representante='Rep',cargo='Sup',fecha_elaboracion=f'{anio}-{mes:02d}-28'))

def esc_vacio():
    return dict(nombre='vacio',anio=2026,mes=4,lavado=[],jornadas={},procesado=[],conteos=[],incidencias=[],equipos=[],mantenimiento=[],retiros=[],acciones=[],pactadas={},
      revision=dict(operacion='Sin actividad',kpi='Sin actividad',incidencias='Sin actividad',equipos='Sin actividad',retiros='Sin actividad',acciones='Sin actividad'),datos=dict(representante='',cargo='',fecha_elaboracion=''))

def esc_pendiente_sin_nada():
    return dict(nombre='sin_empezar',anio=2026,mes=11,lavado=[],jornadas={},procesado=[],conteos=[],incidencias=[],equipos=[],mantenimiento=[],retiros=[],acciones=[],pactadas={},
      revision=dict(operacion='Pendiente',kpi='Pendiente',incidencias='Pendiente',equipos='Pendiente',retiros='Pendiente',acciones='Pendiente'),datos=dict(representante='',cargo='',fecha_elaboracion=''))

def rellenar(esc):
    wb=openpyxl.load_workbook(XLSX)
    ws=wb['Datos_mes']; ws['B7']=esc['mes']; ws['B8']=esc['anio']; ws['B12']=esc['datos']['representante'] or None; ws['B13']=esc['datos']['cargo'] or None
    ws['B14']=serial(esc['datos']['fecha_elaboracion']) if esc['datos']['fecha_elaboracion'] else None
    for hoja,clave in [('Operacion','operacion'),('KPI_calidad','kpi'),('Incidencias','incidencias'),('Equipos','equipos'),('Retiros_importes','retiros'),('Acciones','acciones')]:
        wb[hoja]['B7']=esc['revision'][clave]
    ws=wb['Operacion']
    for r in range(11,42):
        d=r-10
        f=f"{esc['anio']}-{esc['mes']:02d}-{d:02d}"
        j=esc['jornadas'].get(f)
        if not j: continue
        ws[f'B{r}']=j['turistas'];ws[f'E{r}']=j['entregadas'];ws[f'F{r}']=j['horas_previstas'];ws[f'G{r}']=j['horas_trabajadas'];ws[f'H{r}']=j['parada'];ws[f'J{r}']=j['cierre']
    ws=wb['Lavado_detalle']
    for i,x in enumerate(esc['lavado']):
        r=11+i
        ws[f'A{r}']=serial(x['fecha']);ws[f'B{r}']=x['turno'] or None;ws[f'C{r}']=x['vale'] or None;ws[f'D{r}']=x['prenda'];ws[f'E{r}']=x['recibidas'];ws[f'F{r}']=x['pendiente_inicial'];ws[f'G{r}']=x['lavadas'];ws[f'H{r}']=x['kg'];ws[f'J{r}']=x['operario'];ws[f'K{r}']=x['equipo']
    ws=wb['Procesado_detalle']
    for i,x in enumerate(esc['procesado']):
        r=11+i
        ws[f'A{r}']=serial(x['fecha']);ws[f'B{r}']=x['turno'] or None;ws[f'C{r}']=x['area'];ws[f'D{r}']=x['equipo'];ws[f'E{r}']=x['operarios'];ws[f'F{r}']=x['jefe_turno'];ws[f'G{r}']=x['vale'] or None;ws[f'H{r}']=x['prenda'];ws[f'I{r}']=x['declaradas']
        ws[f'J{r}']=hora(x['hora_inicio']) if x['hora_inicio'] else None; ws[f'K{r}']=hora(x['hora_fin']) if x['hora_fin'] else None
        for col,k in zip('LMNOPQ',['conforme','m_rosa','m_negra','m_oxido','m_otras','roturas']): ws[f'{col}{r}']=x[k]
        ws[f'T{r}']=x['pendientes']
    ws=wb['Inventario']
    filas_dia={}
    for r in range(11,476):
        v=ws[f'A{r}'].value
        m=re.match(r'=IF\((\d+)>DAY',str(v))
        if m: filas_dia.setdefault(int(m.group(1)),[]).append(r)
    filas_conteo=[]
    for c in esc['conteos']:
        d=int(c['fecha'][8:]); filas=filas_dia[d]
        fila=next((r for r in filas if ws[f'B{r}'].value==c['ubicacion'] and not any(ws[f'{x}{r}'].value is not None for x in 'CDEFGHIJ')),None)
        if fila is None:
            fila=next(r for r in filas if ws[f'B{r}'].value is None)
            ws[f'B{fila}']=c['ubicacion']
        for col,p in zip('CDEFGHIJ',PRENDAS):
            ws[f'{col}{fila}']=c['valores'][p]
        filas_conteo.append(fila)
    for i,p in enumerate(PRENDAS):
        ws[f'B{483+i}']=esc['pactadas'].get(p)
    ws=wb['Incidencias']
    for i,x in enumerate(esc['incidencias']):
        r=11+i; ws[f'A{r}']=serial(x['fecha']);ws[f'B{r}']=x['causa'];ws[f'C{r}']=x['duracion'];ws[f'H{r}']=x['estado'];ws[f'I{r}']=x['imputable']
    ws=wb['Equipos']
    for i,x in enumerate(esc['equipos']):
        r=11+i; ws[f'A{r}']=x['nombre'];ws[f'B{r}']=x['total'];ws[f'C{r}']=x['operativos']
    for i,x in enumerate(esc['mantenimiento']):
        r=38+i; ws[f'A{r}']=x['tarea'];ws[f'C{r}']=x['tipo'];ws[f'D{r}']=serial(x['fecha_planificada']) if x['fecha_planificada'] else None;ws[f'E{r}']=serial(x['fecha_ejecutada']) if x['fecha_ejecutada'] else None
    ws=wb['Retiros_importes']
    for i,x in enumerate(esc['retiros']):
        r=11+i; ws[f'A{r}']=serial(x['fecha']);ws[f'B{r}']=x['concepto'];ws[f'D{r}']=x['cantidad'];ws[f'G{r}']=x['precio'];ws[f'H{r}']=x['moneda'] or None;ws[f'J{r}']=x['conciliado'];ws[f'K{r}']=x['acta'] or None
    ws=wb['Acciones']
    for i,x in enumerate(esc['acciones']):
        r=11+i; ws[f'A{r}']=serial(x['fecha']);ws[f'C{r}']=x['accion'];ws[f'E{r}']=serial(x['fecha_limite']) if x['fecha_limite'] else None;ws[f'F{r}']=x['estado']
    libro={}
    for h in wb.worksheets:
        filas=[]
        for row in h.iter_rows(min_row=1,max_row=h.max_row,max_col=h.max_column):
            fila=[]
            for c in row:
                v=c.value
                if isinstance(v,str) and v.startswith('='):
                    v=v.replace('_xlfn.','')
                    if '#REF!' in v: v=None
                if isinstance(v,(dt.datetime,dt.date,dt.time)): v=None
                fila.append(v)
            filas.append(fila)
        libro[h.title]=filas
    return libro,filas_conteo

out=[]
for esc in [esc_borde(),esc_completo(),esc_vacio(),esc_pendiente_sin_nada()]:
    libro,fc=rellenar(esc)
    out.append(dict(entrada=esc,libro=libro,filasConteo=fc))
json.dump(dict(prendas=PRENDAS,ubicaciones=UBIC,escenarios=out),open(SALIDA,'w',encoding='utf-8'),ensure_ascii=False)
print('ok',len(out))
