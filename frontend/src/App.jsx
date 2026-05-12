import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, Calendar, DollarSign, Percent, Shield, AlertCircle, TrendingDown, Clock, Download, Wallet, Banknote, Save, Trash2, FolderOpen } from 'lucide-react';

const App = () => {
  // --- Estados de las Variables del Préstamo ---
  const [monto, setMonto] = useState(100000);
  const [anios, setAnios] = useState(10);
  const [tasaAnual, setTasaAnual] = useState(12);
  const [pagoExtra, setPagoExtra] = useState(2000);
  const [frecuenciaExtra, setFrecuenciaExtra] = useState(4);
  const [seguroMensual, setSeguroMensual] = useState(50);
  const [comisionMensual, setComisionMensual] = useState(10);
  const [sueldoQuincenal, setSueldoQuincenal] = useState(15000);
  const [tipoAbono, setTipoAbono] = useState('porcentaje');
  const [abonoInicialInput, setAbonoInicialInput] = useState(10);

  // --- Estados de la Base de Datos ---
  const [nombrePrestamo, setNombrePrestamo] = useState('');
  const [prestamosGuardados, setPrestamosGuardados] = useState([]);

  // --- 1. CARGAR DATOS AL INICIAR ---
  useEffect(() => {
    // Esta ruta relativa funciona porque el backend sirve el frontend
    fetch('/api/prestamos')
      .then(res => {
        if (!res.ok) throw new Error('Error al conectar con el servidor');
        return res.json();
      })
      .then(data => setPrestamosGuardados(data))
      .catch(err => {
        console.warn("Servidor no detectado. Los datos no se guardarán permanentemente.");
      });
  }, []);

  // --- 2. GUARDAR EN COSMOS DB ---
  const guardarPrestamo = async () => {
    if (!nombrePrestamo.trim()) return;
    
    const prestamoData = {
      id: crypto.randomUUID(), // Cosmos DB necesita un string ID único
      nombre: nombrePrestamo,
      monto, 
      anios, 
      tasaAnual, 
      pagoExtra, 
      frecuenciaExtra, 
      seguroMensual, 
      comisionMensual, 
      sueldoQuincenal, 
      tipoAbono, 
      abonoInicialInput,
      fechaCreacion: Date.now()
    };

    try {
      const response = await fetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prestamoData)
      });
      
      if (response.ok) {
        const dataGuardada = await response.json();
        // Actualizamos la lista con el objeto que nos devuelve el servidor
        setPrestamosGuardados(prev => [dataGuardada, ...prev]);
        setNombrePrestamo(''); // Limpiamos el campo de nombre
      } else {
        throw new Error('Error al guardar en el servidor');
      }
    } catch (error) {
      console.error("Error:", error);
      // Fallback local por si el servidor falla (opcional)
      alert("No se pudo conectar con la base de datos de Azure.");
    }
  };

  // --- 3. CARGAR UN PRÉSTAMO EXISTENTE ---
  const cargarPrestamo = (p) => {
    setNombrePrestamo(p.nombre || '');
    setMonto(p.monto);
    setAnios(p.anios);
    setTasaAnual(p.tasaAnual);
    setPagoExtra(p.pagoExtra);
    setFrecuenciaExtra(p.frecuenciaExtra);
    setSeguroMensual(p.seguroMensual);
    setComisionMensual(p.comisionMensual);
    setSueldoQuincenal(p.sueldoQuincenal);
    setTipoAbono(p.tipoAbono);
    setAbonoInicialInput(p.abonoInicialInput);
  };

  // --- 4. ELIMINAR DE COSMOS DB ---
  const eliminarPrestamo = async (id) => {
    try {
      const response = await fetch(`/api/prestamos/${id}`, { method: 'DELETE' });
      if (response.ok) {
        // Filtramos la lista local para que desaparezca de la vista inmediatamente
        setPrestamosGuardados(prev => prev.filter(p => p.id !== id));
      } else {
        throw new Error('Error al eliminar');
      }
    } catch (error) {
      console.error("Error al eliminar:", error);
    }
  };

  // --- UTILIDADES ---
  const formatoMoneda = (valor) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor);
  };

  // --- LÓGICA MATEMÁTICA ---
  const { tabla, resumen } = useMemo(() => {
    const tasaMensual = tasaAnual / 100 / 12;
    const mesesTotales = anios * 12;
    
    let abonoInicialReal = (tipoAbono === 'porcentaje') 
      ? monto * (abonoInicialInput / 100) 
      : abonoInicialInput;

    const montoFinanciar = Math.max(0, monto - abonoInicialReal);
    const sueldoMensual = sueldoQuincenal * 2;

    let pagoMensualBase = (tasaMensual === 0)
      ? montoFinanciar / mesesTotales
      : montoFinanciar * (tasaMensual * Math.pow(1 + tasaMensual, mesesTotales)) / (Math.pow(1 + tasaMensual, mesesTotales) - 1);

    let saldo = parseFloat(montoFinanciar);
    let mesActual = 1;
    let datosTabla = [];
    let totalIntereses = 0;
    let totalAbonoExtra = 0;

    while (saldo > 0.01 && mesActual <= mesesTotales * 2) {
      const interes = saldo * tasaMensual;
      let capital = pagoMensualBase - interes;
      let abonoExtraEsteMes = (mesActual % frecuenciaExtra === 0) ? parseFloat(pagoExtra) : 0;

      if (saldo < (capital + abonoExtraEsteMes)) {
        capital = saldo;
        abonoExtraEsteMes = 0;
      }

      const totalCapital = capital + abonoExtraEsteMes;
      const saldoFinal = Math.max(0, saldo - totalCapital);
      const segurosYComisiones = parseFloat(seguroMensual) + parseFloat(comisionMensual);
      const pagoTotal = capital + interes + abonoExtraEsteMes + segurosYComisiones;
      
      const sueldoRestante = sueldoMensual - (capital + interes + segurosYComisiones);

      datosTabla.push({
        mes: mesActual,
        sueldoMensual: sueldoMensual,
        saldoInicial: saldo,
        pagoTotal: pagoTotal,
        pagoPrestamoBase: capital + interes,
        capital: capital,
        interes: interes,
        pagoExtra: abonoExtraEsteMes,
        segurosYComisiones: segurosYComisiones,
        sueldoRestante: sueldoRestante,
        saldoFinal: saldoFinal,
        esFinDeAno: mesActual % 12 === 0,
        anoCorrespondiente: Math.ceil(mesActual / 12)
      });

      totalIntereses += interes;
      totalAbonoExtra += abonoExtraEsteMes;
      saldo = saldoFinal;
      mesActual++;
    }

    return {
      tabla: datosTabla,
      resumen: {
        montoFinanciar,
        abonoInicial: abonoInicialReal,
        pagoMensualEstimado: pagoMensualBase + parseFloat(seguroMensual) + parseFloat(comisionMensual),
        totalIntereses,
        totalAbonoExtra,
        mesesReales: mesActual - 1,
        ahorroTiempo: mesesTotales - (mesActual - 1)
      }
    };
  }, [monto, anios, tasaAnual, pagoExtra, frecuenciaExtra, seguroMensual, comisionMensual, sueldoQuincenal, tipoAbono, abonoInicialInput]);

  const handleExportarCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "RESUMEN DEL PRESTAMO\n";
    csvContent += `Monto Original,${monto}\nAbono Inicial,${resumen.abonoInicial}\nMonto a Financiar,${resumen.montoFinanciar}\n\n`;
    csvContent += "Mes,Saldo Inicial,Pago Total,Capital,Interes,Pago Extra,Seguros,Saldo Final\n";

    tabla.forEach(row => {
      csvContent += `${row.mes},${row.saldoInicial.toFixed(2)},${row.pagoTotal.toFixed(2)},${row.capital.toFixed(2)},${row.interes.toFixed(2)},${row.pagoExtra.toFixed(2)},${row.segurosYComisiones.toFixed(2)},${row.saldoFinal.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Simulacion_Prestamo.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Encabezado */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="bg-blue-600 p-3 rounded-xl text-white">
            <Calculator size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Simulador de Préstamo Interactivo</h1>
            <p className="text-gray-500 text-sm">Gestionado con Node.js y Azure Cosmos DB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Panel Lateral */}
          <div className="lg:col-span-1 space-y-6">

            {/* Guardado y Lista de Préstamos */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 bg-gradient-to-br from-blue-50 to-white">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-blue-800">
                <Save size={20} className="mr-2" />
                Guardar en la Nube
              </h2>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    placeholder="Nombre del proyecto..."
                    value={nombrePrestamo}
                    onChange={(e) => setNombrePrestamo(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                  <button 
                    onClick={guardarPrestamo}
                    disabled={!nombrePrestamo.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium transition-colors"
                  >
                    Guardar
                  </button>
                </div>

                {prestamosGuardados.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {prestamosGuardados.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-300 transition-all group">
                          <button onClick={() => cargarPrestamo(p)} className="flex-1 flex items-center text-left truncate">
                            <FolderOpen size={16} className="text-blue-500 mr-2 opacity-70 group-hover:opacity-100" />
                            <span className="text-sm font-medium text-gray-700 truncate">{p.nombre}</span>
                          </button>
                          <button onClick={() => eliminarPrestamo(p.id)} className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controles de Variables */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-lg font-semibold flex items-center"><AlertCircle size={20} className="mr-2 text-blue-500"/>Variables</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto del Préstamo</label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input type="number" value={monto} onChange={(e) => setMonto(Number(e.target.value))} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Años</label>
                  <input type="number" value={anios} onChange={(e) => setAnios(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tasa %</label>
                  <input type="number" value={tasaAnual} onChange={(e) => setTasaAnual(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"/>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sueldo Quincenal</label>
                <input type="number" value={sueldoQuincenal} onChange={(e) => setSueldoQuincenal(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"/>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pago Extra a Capital</label>
                <div className="flex space-x-2">
                  <input type="number" value={pagoExtra} onChange={(e) => setPagoExtra(Number(e.target.value))} className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"/>
                  <input type="number" title="Frecuencia en meses" value={frecuenciaExtra} onChange={(e) => setFrecuenciaExtra(Number(e.target.value))} className="w-16 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none"/>
                </div>
              </div>
            </div>
          </div>

          {/* Área Principal */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tarjetas de Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-100">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Monto Real</span>
                <div className="text-lg font-bold">{formatoMoneda(resumen.montoFinanciar)}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-gray-100">
                <span className="text-[10px] text-gray-500 uppercase font-bold">Cuota Total</span>
                <div className="text-lg font-bold">{formatoMoneda(resumen.pagoMensualEstimado)}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-red-100 bg-red-50">
                <span className="text-[10px] text-red-700 uppercase font-bold">Intereses</span>
                <div className="text-lg font-bold text-red-700">{formatoMoneda(resumen.totalIntereses)}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-green-100 bg-green-50">
                <span className="text-[10px] text-green-700 uppercase font-bold">Ahorro Extra</span>
                <div className="text-lg font-bold text-green-700">{formatoMoneda(resumen.totalAbonoExtra)}</div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-100 bg-blue-50">
                <span className="text-[10px] text-blue-700 uppercase font-bold">Plazo Real</span>
                <div className="text-lg font-bold text-blue-700">{resumen.mesesReales} meses</div>
              </div>
            </div>

            {/* Tabla de Resultados */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-semibold">Amortización Detallada</h3>
                <button onClick={handleExportarCSV} className="flex items-center space-x-2 text-sm text-blue-600 font-bold hover:underline">
                  <Download size={16} />
                  <span>Descargar CSV</span>
                </button>
              </div>
              <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Mes</th>
                      <th className="px-4 py-3">Saldo</th>
                      <th className="px-4 py-3">Pago</th>
                      <th className="px-4 py-3">Capital</th>
                      <th className="px-4 py-3">Interés</th>
                      <th className="px-4 py-3">Extra</th>
                      <th className="px-4 py-3">Restante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tabla.map((fila, i) => (
                      <tr key={i} className={fila.pagoExtra > 0 ? 'bg-green-50/30' : ''}>
                        <td className="px-4 py-3 font-bold">{fila.mes}</td>
                        <td className="px-4 py-3 text-gray-500">{formatoMoneda(fila.saldoInicial)}</td>
                        <td className="px-4 py-3 font-bold">{formatoMoneda(fila.pagoTotal)}</td>
                        <td className="px-4 py-3">{formatoMoneda(fila.capital)}</td>
                        <td className="px-4 py-3 text-red-500">{formatoMoneda(fila.interes)}</td>
                        <td className="px-4 py-3 text-green-600 font-bold">{fila.pagoExtra > 0 ? formatoMoneda(fila.pagoExtra) : '-'}</td>
                        <td className="px-4 py-3 font-bold text-blue-700">{formatoMoneda(fila.sueldoRestante)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default App;