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

  // --- Estados de Guardado (Independiente de Firebase) ---
  const [nombrePrestamo, setNombrePrestamo] = useState('');
  const [prestamosGuardados, setPrestamosGuardados] = useState([]);

  // --- Comunicación con el Backend Node.js ---
  useEffect(() => {
    fetch('/api/prestamos')
      .then(res => {
        if (!res.ok) throw new Error('Servidor no disponible');
        return res.json();
      })
      .then(data => setPrestamosGuardados(data))
      .catch(err => {
        console.log("Usando almacenamiento en memoria para la vista previa local.");
      });
  }, []);

  const guardarPrestamo = async () => {
    if (!nombrePrestamo.trim()) return;
    
    const prestamoData = {
      id: crypto.randomUUID(),
      nombre: nombrePrestamo,
      monto, anios, tasaAnual, pagoExtra, frecuenciaExtra, 
      seguroMensual, comisionMensual, sueldoQuincenal, 
      tipoAbono, abonoInicialInput,
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
        setPrestamosGuardados(prev => [dataGuardada, ...prev]);
      } else {
        throw new Error('Error en el backend');
      }
    } catch (error) {
      setPrestamosGuardados(prev => [prestamoData, ...prev]);
    }
    
    setNombrePrestamo('');
  };

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

  const eliminarPrestamo = async (id) => {
    try {
      const response = await fetch(`/api/prestamos/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setPrestamosGuardados(prev => prev.filter(p => p.id !== id));
      } else {
        throw new Error('Error eliminando en backend');
      }
    } catch (error) {
      setPrestamosGuardados(prev => prev.filter(p => p.id !== id));
    }
  };

  // --- Utilidades ---
  const formatoMoneda = (valor) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor);
  };

  // --- Cálculo Matemático de la Tabla ---
  const { tabla, resumen } = useMemo(() => {
    const tasaMensual = tasaAnual / 100 / 12;
    const mesesTotales = anios * 12;
    
    let abonoInicialReal = 0;
    if (tipoAbono === 'porcentaje') {
      abonoInicialReal = monto * (abonoInicialInput / 100);
    } else {
      abonoInicialReal = abonoInicialInput;
    }
    const montoFinanciar = Math.max(0, monto - abonoInicialReal);
    const sueldoMensual = sueldoQuincenal * 2;

    let pagoMensualBase = 0;
    if (tasaMensual === 0) {
      pagoMensualBase = montoFinanciar / mesesTotales;
    } else {
      pagoMensualBase = montoFinanciar * (tasaMensual * Math.pow(1 + tasaMensual, mesesTotales)) / (Math.pow(1 + tasaMensual, mesesTotales) - 1);
    }

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
      const saldoFinal = saldo - totalCapital;
      const segurosYComisiones = parseFloat(seguroMensual) + parseFloat(comisionMensual);
      const pagoTotal = capital + interes + abonoExtraEsteMes + segurosYComisiones;
      
      const pagoFijoSinExtra = capital + interes + segurosYComisiones;
      const sueldoRestante = sueldoMensual - pagoFijoSinExtra;

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
        saldoFinal: Math.abs(saldoFinal) < 0.01 ? 0 : saldoFinal,
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
        montoFinanciar: montoFinanciar,
        abonoInicial: abonoInicialReal,
        pagoMensualEstimado: pagoMensualBase + parseFloat(seguroMensual) + parseFloat(comisionMensual),
        totalIntereses: totalIntereses,
        totalAbonoExtra: totalAbonoExtra,
        mesesReales: mesActual - 1,
        ahorroTiempo: mesesTotales - (mesActual - 1)
      }
    };
  }, [monto, anios, tasaAnual, pagoExtra, frecuenciaExtra, seguroMensual, comisionMensual, sueldoQuincenal, tipoAbono, abonoInicialInput]);

  const handleExportarCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    
    csvContent += "RESUMEN DEL PRESTAMO\n";
    csvContent += `Monto Original,${monto}\n`;
    csvContent += `Abono Inicial (Enganche),${resumen.abonoInicial}\n`;
    csvContent += `Monto a Financiar,${resumen.montoFinanciar}\n`;
    csvContent += `Tasa Anual (%),${tasaAnual}\n`;
    csvContent += `Plazo Original (Anios),${anios}\n`;
    csvContent += `Sueldo Quincenal,${sueldoQuincenal}\n`;
    csvContent += `Sueldo Mensual,${sueldoQuincenal * 2}\n\n`;

    csvContent += "Mes,Saldo Inicial,Pago Total,Capital,Interes,Pago Extra,Seguros y Comisiones,Saldo Final,Sueldo Mensual,Sueldo Restante\n";

    tabla.forEach(row => {
      csvContent += `${row.mes},${row.saldoInicial.toFixed(2)},${row.pagoTotal.toFixed(2)},${row.capital.toFixed(2)},${row.interes.toFixed(2)},${row.pagoExtra.toFixed(2)},${row.segurosYComisiones.toFixed(2)},${row.saldoFinal.toFixed(2)},${row.sueldoMensual.toFixed(2)},${row.sueldoRestante.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Simulador_Amortizacion.csv");
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
            <p className="text-gray-500 text-sm">Ajusta las variables para ver cómo impactan los pagos a capital en el tiempo.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Panel Lateral - Controles */}
          <div className="lg:col-span-1 space-y-6">

            {/* Panel de Guardado Independiente */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 bg-gradient-to-br from-blue-50 to-white">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-blue-800">
                <Save size={20} className="mr-2" />
                Mis Préstamos Guardados
              </h2>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <input 
                    type="text" 
                    placeholder="Nombre (ej. Auto, Casa...)"
                    value={nombrePrestamo}
                    onChange={(e) => setNombrePrestamo(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  />
                  <button 
                    onClick={guardarPrestamo}
                    disabled={!nombrePrestamo.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                  >
                    Guardar
                  </button>
                </div>
                {prestamosGuardados.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {prestamosGuardados.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group">
                          <button onClick={() => cargarPrestamo(p)} className="flex-1 flex items-center text-left truncate">
                            <FolderOpen size={16} className="text-blue-500 mr-2 flex-shrink-0 opacity-70 group-hover:opacity-100" />
                            <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700 truncate">{p.nombre}</span>
                          </button>
                          <button onClick={() => eliminarPrestamo(p.id)} className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors flex-shrink-0">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Variables Principales */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <AlertCircle size={20} className="mr-2 text-blue-500"/>
                Variables Principales
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto del Préstamo</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><DollarSign size={16} className="text-gray-400" /></div>
                    <input type="number" value={monto} onChange={(e) => setMonto(Number(e.target.value))} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"/>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plazo (Años)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Calendar size={16} className="text-gray-400" /></div>
                      <input type="number" value={anios} onChange={(e) => setAnios(Number(e.target.value))} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Interés Anual</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Percent size={16} className="text-gray-400" /></div>
                      <input type="number" value={tasaAnual} onChange={(e) => setTasaAnual(Number(e.target.value))} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"/>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ingresos y Abono Inicial */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <Wallet size={20} className="mr-2 text-indigo-500"/>
                Ingresos y Abono Inicial
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sueldo Quincenal</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Banknote size={16} className="text-gray-400" /></div>
                    <input type="number" value={sueldoQuincenal} onChange={(e) => setSueldoQuincenal(Number(e.target.value))} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Abono Inicial (Enganche)</label>
                  <div className="flex space-x-2">
                    <select value={tipoAbono} onChange={(e) => setTipoAbono(e.target.value)} className="w-1/3 px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm">
                      <option value="porcentaje">% del Monto</option>
                      <option value="fijo">Monto Fijo</option>
                    </select>
                    <div className="relative w-2/3">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">{tipoAbono === 'porcentaje' ? <Percent size={14} className="text-gray-400" /> : <DollarSign size={14} className="text-gray-400" />}</div>
                      <input type="number" value={abonoInicialInput} onChange={(e) => setAbonoInicialInput(Number(e.target.value))} className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"/>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Equivale a: {formatoMoneda(resumen.abonoInicial)}</div>
                </div>
              </div>
            </div>

            {/* Pagos Extra */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <TrendingDown size={20} className="mr-2 text-green-500"/>
                Pagos Extra a Capital
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto del Pago Extra</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><DollarSign size={16} className="text-gray-400" /></div>
                    <input type="number" value={pagoExtra} onChange={(e) => setPagoExtra(Number(e.target.value))} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frecuencia (Cada X meses)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Clock size={16} className="text-gray-400" /></div>
                    <input type="number" min="1" value={frecuenciaExtra} onChange={(e) => setFrecuenciaExtra(Math.max(1, Number(e.target.value)))} className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"/>
                  </div>
                </div>
              </div>
            </div>

            {/* Seguros */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                <Shield size={20} className="mr-2 text-purple-500"/>
                Seguros y Comisiones
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seguro Mensual</label>
                  <input type="number" value={seguroMensual} onChange={(e) => setSeguroMensual(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Otras Comisiones</label>
                  <input type="number" value={comisionMensual} onChange={(e) => setComisionMensual(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"/>
                </div>
              </div>
            </div>

          </div>

          {/* Área Principal - Resumen y Tabla */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Tarjetas de Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Monto a Financiar</span>
                <span className="text-xl font-bold text-gray-900 mt-1">{formatoMoneda(resumen.montoFinanciar)}</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Pago Mensual</span>
                <span className="text-xl font-bold text-gray-900 mt-1">{formatoMoneda(resumen.pagoMensualEstimado)}</span>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Total Intereses</span>
                <span className="text-xl font-bold text-red-600 mt-1">{formatoMoneda(resumen.totalIntereses)}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-green-200 bg-green-50 flex flex-col justify-center">
                <span className="text-xs text-green-700 font-medium uppercase tracking-wider">Total Extra Aportado</span>
                <span className="text-xl font-bold text-green-700 mt-1">{formatoMoneda(resumen.totalAbonoExtra)}</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50 flex flex-col justify-center">
                <span className="text-xs text-blue-700 font-medium uppercase tracking-wider">Meses a Liquidar</span>
                <div className="flex flex-col mt-1">
                  <span className="text-xl font-bold text-blue-700">{resumen.mesesReales}</span>
                  {resumen.ahorroTiempo > 0 && (
                    <span className="text-[10px] font-semibold text-green-600 mt-0.5">-{resumen.ahorroTiempo} meses ahorrados</span>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla de Excel */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[700px]">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Desglose Mensual</h3>
                <button onClick={handleExportarCSV} className="flex items-center space-x-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
                  <Download size={16} />
                  <span>Exportar a CSV</span>
                </button>
              </div>
              <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-600 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">Mes</th>
                      <th className="px-4 py-3 whitespace-nowrap">Saldo Inicial</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-blue-50/50">Pago Total</th>
                      <th className="px-4 py-3 whitespace-nowrap">Capital</th>
                      <th className="px-4 py-3 whitespace-nowrap text-red-600">Interés</th>
                      <th className="px-4 py-3 whitespace-nowrap text-green-600">Pago Extra</th>
                      <th className="px-4 py-3 whitespace-nowrap text-purple-600">Seguros/Com.</th>
                      <th className="px-4 py-3 whitespace-nowrap">Saldo Final</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-indigo-50">Sueldo Mensual</th>
                      <th className="px-4 py-3 whitespace-nowrap bg-indigo-50">Sueldo Restante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tabla.map((fila, index) => (
                      <React.Fragment key={index}>
                        <tr className={`hover:bg-gray-50 transition-colors ${fila.pagoExtra > 0 ? 'bg-green-50/20' : ''}`}>
                          <td className="px-4 py-3 font-medium text-gray-900">{fila.mes}</td>
                          <td className="px-4 py-3">{formatoMoneda(fila.saldoInicial)}</td>
                          <td className="px-4 py-3 font-semibold bg-blue-50/20">{formatoMoneda(fila.pagoTotal)}</td>
                          <td className="px-4 py-3">{formatoMoneda(fila.capital)}</td>
                          <td className="px-4 py-3 text-red-600/80">{formatoMoneda(fila.interes)}</td>
                          <td className={`px-4 py-3 ${fila.pagoExtra > 0 ? 'font-semibold text-green-600' : 'text-gray-400'}`}>{formatoMoneda(fila.pagoExtra)}</td>
                          <td className="px-4 py-3 text-purple-600/80">{formatoMoneda(fila.segurosYComisiones)}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{formatoMoneda(fila.saldoFinal)}</td>
                          <td className="px-4 py-3 font-medium text-indigo-700 bg-indigo-50/20">{formatoMoneda(fila.sueldoMensual)}</td>
                          <td className="px-4 py-3 font-medium text-indigo-700 bg-indigo-50/20">{formatoMoneda(fila.sueldoRestante)}</td>
                        </tr>
                        {fila.esFinDeAno && fila.saldoFinal > 0 && (
                          <tr className="bg-gray-800 text-white">
                            <td colSpan="10" className="px-4 py-2 text-center text-xs font-bold uppercase tracking-widest">
                              --- Fin del Año {fila.anoCorrespondiente} • Saldo restante: {formatoMoneda(fila.saldoFinal)} ---
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />
    </div>
  );
};

export default App;