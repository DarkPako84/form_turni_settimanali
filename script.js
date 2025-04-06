document.addEventListener('DOMContentLoaded', () => {
    const weekPicker = document.getElementById('week-picker');
    const scheduleContainer = document.getElementById('schedule-container');
    const scheduleForm = document.getElementById('schedule-form');
    const submitButton = document.getElementById('submit-button');
    const statusMessage = document.getElementById('status-message');

    // --- CONFIGURAZIONE ---
    const N8N_WEBHOOK_URL = 'https://n8n.gogetalab.duckdns.org:18443/webhook-test/d247d851-104d-4984-a0c9-37b9a1711d1e'; // <-- CAMBIA QUESTO!
    const SHIFT_TYPES = ['Seleziona...', 'Mattina', 'Sera', 'Riposo']; // Aggiungi/modifica i tuoi turni
    const SHIFT_PRESETS = {
        // Definisci orario inizio standard e durata (in ore)
        'Mattina': { start: '09:00', duration: 5 },
        'Sera': { start: '16:00', duration: 5 }, // Esempio
        // 'Riposo' non ha bisogno di preset orari
    };
    const TIME_STEP_MINUTES = 30;
    // --- FINE CONFIGURAZIONE ---

    weekPicker.addEventListener('change', generateWeekRows);
    scheduleForm.addEventListener('submit', handleSubmit);

    // Funzione per generare le righe della settimana
    function generateWeekRows() {
        scheduleContainer.innerHTML = ''; // Pulisce il contenitore
        const selectedDate = new Date(weekPicker.value + 'T00:00:00'); // Assicura che sia locale
        if (isNaN(selectedDate)) return; // Data non valida

        const dayOfWeek = selectedDate.getDay(); // 0=Dom, 1=Lun,... 6=Sab
        // Calcola il Lunedì di quella settimana (gestisce la Domenica come giorno 0)
        const diff = selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(selectedDate.setDate(diff));

        const dateFormatter = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const isoDateFormatter = (date) => date.toISOString().split('T')[0]; // Formato YYYY-MM-DD

        for (let i = 0; i < 7; i++) {
            const currentDay = new Date(monday);
            currentDay.setDate(monday.getDate() + i);

            const formattedDate = dateFormatter.format(currentDay);
            const isoDate = isoDateFormatter(currentDay);

            const row = document.createElement('div');
            row.classList.add('day-row');
            row.dataset.date = isoDate; // Salva la data ISO YYYY-MM-DD

            // 1. Etichetta Giorno
            const dayLabel = document.createElement('span');
            dayLabel.textContent = formattedDate;
            row.appendChild(dayLabel);

            // 2. Select Turno
            const shiftSelect = document.createElement('select');
            shiftSelect.name = `shift_${isoDate}`;
            SHIFT_TYPES.forEach(shift => {
                const option = document.createElement('option');
                option.value = shift === 'Seleziona...' ? '' : shift;
                option.textContent = shift;
                shiftSelect.appendChild(option);
            });
            shiftSelect.addEventListener('change', handleShiftChange);
            row.appendChild(shiftSelect);

            // 3. Controlli Orario (inizialmente nascosti/vuoti)
             // Usiamo un div wrapper per nasconderli/mostrarli insieme
            const timeControlsWrapper = document.createElement('div');
            timeControlsWrapper.classList.add('time-controls', 'hidden'); // Nascosto di default

            // Campo Ora Inizio
            const startTimeInput = document.createElement('input');
            startTimeInput.type = 'time';
            startTimeInput.name = `start_${isoDate}`;
            startTimeInput.step = TIME_STEP_MINUTES * 60; // Step in secondi
            startTimeInput.addEventListener('change', handleStartTimeChange); // Ricalcola fine se inizio cambia
            timeControlsWrapper.appendChild(startTimeInput);

            // Campo Ora Fine
            const endTimeInput = document.createElement('input');
            endTimeInput.type = 'time';
            endTimeInput.name = `end_${isoDate}`;
            endTimeInput.step = TIME_STEP_MINUTES * 60; // Step in secondi
            timeControlsWrapper.appendChild(endTimeInput);

             // Bottone Diminuisci Ora Inizio
            const decreaseBtn = document.createElement('button');
            decreaseBtn.type = 'button';
            decreaseBtn.textContent = '-';
            decreaseBtn.classList.add('decrease-btn');
            decreaseBtn.dataset.target = `start_${isoDate}`; // Lega al campo ora inizio
            decreaseBtn.addEventListener('click', adjustTime);
            timeControlsWrapper.appendChild(decreaseBtn);

            // Bottone Aumenta Ora Inizio
            const increaseBtn = document.createElement('button');
            increaseBtn.type = 'button';
            increaseBtn.textContent = '+';
            increaseBtn.classList.add('increase-btn');
            increaseBtn.dataset.target = `start_${isoDate}`; // Lega al campo ora inizio
            increaseBtn.addEventListener('click', adjustTime);
            timeControlsWrapper.appendChild(increaseBtn);

            // Aggiungi il wrapper alla riga
            row.appendChild(timeControlsWrapper);


            scheduleContainer.appendChild(row);
        }
    }

    // Gestisce il cambio del turno selezionato
    function handleShiftChange(event) {
        const selectElement = event.target;
        const row = selectElement.closest('.day-row');
        const timeControls = row.querySelector('.time-controls');
        const startTimeInput = row.querySelector(`input[name^="start_"]`);
        const endTimeInput = row.querySelector(`input[name^="end_"]`);
        const selectedShift = selectElement.value;

        if (selectedShift && SHIFT_PRESETS[selectedShift]) {
            const preset = SHIFT_PRESETS[selectedShift];
            startTimeInput.value = preset.start;
            endTimeInput.value = calculateEndTime(preset.start, preset.duration);
            timeControls.classList.remove('hidden');
        } else {
            // Nasconde e resetta per "Seleziona..." o "Riposo" o turni senza preset
            startTimeInput.value = '';
            endTimeInput.value = '';
            timeControls.classList.add('hidden');
        }
    }

     // Ricalcola ora fine quando ora inizio viene modificata manualmente
     function handleStartTimeChange(event) {
        const startTimeInput = event.target;
        const row = startTimeInput.closest('.day-row');
        const endTimeInput = row.querySelector(`input[name^="end_"]`);
        const shiftSelect = row.querySelector('select');
        const selectedShift = shiftSelect.value;

        if (selectedShift && SHIFT_PRESETS[selectedShift] && startTimeInput.value) {
             const preset = SHIFT_PRESETS[selectedShift];
             endTimeInput.value = calculateEndTime(startTimeInput.value, preset.duration);
        }
     }

    // Gestisce click sui bottoni +/-
    function adjustTime(event) {
        const button = event.target;
        const targetInputName = button.dataset.target;
        const inputElement = document.querySelector(`input[name="${targetInputName}"]`);
        if (!inputElement || !inputElement.value) return; // Non fare nulla se l'input è vuoto

        const isIncrease = button.classList.contains('increase-btn');
        const adjustment = (isIncrease ? TIME_STEP_MINUTES : -TIME_STEP_MINUTES);

        const currentTime = inputElement.value.split(':');
        const currentMinutes = parseInt(currentTime[0], 10) * 60 + parseInt(currentTime[1], 10);
        let newTotalMinutes = currentMinutes + adjustment;

        // Gestione del superamento mezzanotte (modulo 1440 minuti = 24 * 60)
        newTotalMinutes = (newTotalMinutes % 1440 + 1440) % 1440; // Assicura risultato positivo

        const newHours = Math.floor(newTotalMinutes / 60).toString().padStart(2, '0');
        const newMinutes = (newTotalMinutes % 60).toString().padStart(2, '0');
        inputElement.value = `${newHours}:${newMinutes}`;

        // Triggera l'evento 'change' sull'input per ricalcolare l'ora fine
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    }


    // Calcola l'ora di fine
    function calculateEndTime(startTime, durationHours) {
        if (!startTime) return '';
        const time = startTime.split(':');
        const startMinutes = parseInt(time[0], 10) * 60 + parseInt(time[1], 10);
        const durationMinutes = durationHours * 60;
        let endMinutes = startMinutes + durationMinutes;

        // Gestione superamento mezzanotte
        endMinutes = (endMinutes % 1440 + 1440) % 1440;

        const endHours = Math.floor(endMinutes / 60).toString().padStart(2, '0');
        const endMins = (endMinutes % 60).toString().padStart(2, '0');
        return `${endHours}:${endMins}`;
    }

    // Gestisce l'invio del form
    async function handleSubmit(event) {
        event.preventDefault(); // Previene ricaricamento pagina
        submitButton.disabled = true;
        statusMessage.textContent = 'Invio in corso...';
        statusMessage.className = '';

        const weeklyData = [];
        const rows = scheduleContainer.querySelectorAll('.day-row');

        rows.forEach(row => {
            const date = row.dataset.date;
            const shift = row.querySelector('select').value;
            const startTime = row.querySelector(`input[name^="start_"]`).value;
            const endTime = row.querySelector(`input[name^="end_"]`).value;

            // Includi solo se è stato selezionato un turno valido
            if (date && shift) {
                weeklyData.push({
                    date: date,
                    shift: shift,
                    startTime: shift !== 'Riposo' ? startTime : null, // Non inviare orari per riposo
                    endTime: shift !== 'Riposo' ? endTime : null,
                });
            }
        });

        if (weeklyData.length === 0) {
             statusMessage.textContent = 'Nessun turno selezionato per la settimana.';
             statusMessage.className = 'error';
             submitButton.disabled = false;
             return;
        }

        //console.log('Dati da inviare:', JSON.stringify({ weekSchedule: weeklyData })); // Per Debug

        try {
            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ weekSchedule: weeklyData }), // Invia i dati come oggetto JSON
            });

            if (response.ok) {
                statusMessage.textContent = 'Settimana inviata con successo!';
                statusMessage.className = 'success';
                 // scheduleForm.reset(); // Opzionale: resetta il form dopo invio
                 // scheduleContainer.innerHTML = ''; // Opzionale: pulisce le righe
                 // weekPicker.value = ''; // Opzionale: resetta il date picker
            } else {
                const errorData = await response.text(); // Leggi errore come testo
                throw new Error(`Errore ${response.status}: ${errorData}`);
            }
        } catch (error) {
            console.error('Errore invio dati:', error);
            statusMessage.textContent = `Errore durante l'invio: ${error.message}`;
            statusMessage.className = 'error';
        } finally {
            submitButton.disabled = false; // Riabilita il bottone
        }
    }
});
