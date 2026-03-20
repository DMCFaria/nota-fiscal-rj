
export const formatarData = (dataString) => {
        if (!dataString) return '--';
        const data = new Date(dataString);
        return data.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
};

export const formatTempo = (date) => {
  return date.toLocaleTimeString('pt-BR');
};