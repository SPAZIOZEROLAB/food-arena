# Food Arena: guida per presentarlo

## Il progetto in una frase

Il cliente scrive quanto vuole spendere e quando vuole mangiare. I locali propongono piatti compatibili, anche con l’aiuto dell’AI. Il cliente confronta e sceglie. Avalanche custodisce il budget delle commissioni autorizzate dal locale.

## Racconto da 2–3 minuti

Questi paragrafi seguono le otto slide. Sono anche nelle note del PowerPoint.

### Slide 1. Anna cerca pranzo

Anna è a Pescara, in Viale Pindaro. Ha dieci euro e mezz’ora per pranzare. Scrive una richiesta su Food Arena. Invece di cercare in tanti menu, aspetta le proposte dei locali vicini.

### Slide 2. Le offerte e la scelta

Tutti i locali aderenti che possono soddisfare la richiesta hanno la possibilità di proporre. Anna confronta piatto, prezzo e tempi. Le offerte continuano ad arrivare fino alla sua scelta o alla scadenza. Può anche non comprare. Questi tre locali sono esempi fittizi della demo.

### Slide 3. Il gestore e l’AI

Luca gestisce un locale. Decide cosa vende, a quale prezzo e quante porzioni può preparare. Può rispondere personalmente oppure autorizzare l’AI a proporre piatti entro quelle regole. Oggi l’automazione funziona mentre il suo pannello resta aperto.

### Slide 4. Chi paga Food Arena

Il cliente paga soltanto il prezzo del pranzo al locale. Proponiamo che sia il locale a pagare Food Arena: settanta centesimi per ogni ritiro completato. Iscrizione e invio delle offerte sono gratuiti, senza canone. È un prezzo da verificare, oggi non attivo.

### Slide 5. Il budget del locale

Il budget del locale serve a pagare queste commissioni. Per capirlo, immaginiamo sette euro messi da parte: coprirebbero dieci ritiri da settanta centesimi. Sono separati dai soldi del pranzo. Oggi non versiamo euro: la prova usa gettoni senza valore reale.

### Slide 6. La cassaforte Avalanche

La cassaforte è un programma su Avalanche che controlla firme e limiti. Alla scelta riserva la commissione. Al ritiro Luca controlla il codice e firma la conferma. Il programma accredita Food Arena una sola volta. Se invece Anna non ritira, alla scadenza una transazione libera la riserva. La consegna resta attestata da Luca.

### Slide 7. La demo disponibile

L’app e il codice sono pubblici. Possiamo mostrare richiesta, offerte, scelta e ritiro simulato, con transazioni vere sulla rete di prova Fuji. Abbiamo verificato il funzionamento tecnico. I locali sono fittizi e il passaggio ai pagamenti reali resta da realizzare.

### Slide 8. Il primo mercato proposto

Il prossimo passo proposto è una zona di Pescara, con gestori e clienti da reclutare. Misureremo ordini aggiuntivi, clienti che tornano e lavoro dei locali. Verificheremo se pagherebbero la commissione e se il servizio copre i costi. Il mercato commerciale deve ancora essere dimostrato.

## Le risposte alle domande più probabili

### Che cosa cambia rispetto a leggere un menu?

Il cliente pubblica un bisogno preciso, con zona, budget e orario. I locali aderenti rispondono con offerte compatibili e il cliente confronta quelle ricevute. La proposta parte dal bisogno del cliente. Il beneficio concreto da verificare è ricevere proposte utili senza cercarle una per una.

### Il cliente vede soltanto tre locali?

No. I tre nomi mostrati nelle slide sono esempi fittizi della demo. Il modello è aperto a tutti i locali aderenti compatibili con la richiesta. La disponibilità effettiva dipende da zona, prezzi, quantità e tempi. Le offerte possono arrivare fino alla scelta o alla scadenza della richiesta. Il cliente può anche non comprare.

### Se ho dieci euro, devo spenderli tutti?

No. Dieci euro è il massimo. Se scegli un’offerta da 8,50 euro, paghi 8,50 euro al locale. Non aggiungiamo una quota al prezzo del cliente.

### Che cosa fa l’AI? Il ristoratore perde il controllo?

Il gestore decide menu, prezzi, porzioni e tempi. Può rispondere personalmente oppure abilitare l’AI. Il modello confronta la richiesta con i piatti e prepara proposte entro le regole autorizzate. Nel prototipo il pannello del gestore deve restare aperto. Non dichiariamo già disponibili notifiche push o automazione con il pannello chiuso.

### Chi paga i settanta centesimi?

Il locale, per ogni ordine ritirato. Il cliente paga soltanto il pasto. I 0,70 euro sono una proposta da verificare con i gestori, oggi non attiva. Iscrizione e invio delle offerte restano gratuiti nel modello proposto, senza canone.

### Su un pranzo da dieci euro, quanto resta al locale?

Incassa dieci euro e sostiene separatamente settanta centesimi di commissione. Rimangono 9,30 euro prima dei costi del cibo, del personale e degli altri costi. Non sono 9,30 euro di utile. Per Food Arena, i settanta centesimi sarebbero ricavo prima dei costi.

### Perché un locale dovrebbe pagare?

Può convenirgli se riceve ordini aggiuntivi con un margine sufficiente e senza troppo lavoro. Se l’ordine sarebbe arrivato comunque, o il locale è già pieno, il valore può essere minore. La prova commerciale deve misurare questi aspetti e la disponibilità a continuare pagando.

### Qual è la differenza fra il budget del cliente e quello del locale?

Il budget del cliente serve al pranzo. Quello del locale è una somma che mette da parte per pagare le commissioni di Food Arena. Nell’esempio futuro, sette euro coprirebbero dieci commissioni da settanta centesimi. Sono somme destinate a due spese diverse. Oggi non esistono versamenti in euro nel prototipo: la demo usa gettoni di prova e non applica un cambio con gli euro.

### Dove entra esattamente Avalanche?

La cassaforte è un programma su Avalanche, chiamato smart contract, che controlla firme e limiti. Custodisce il budget autorizzato dal locale. Alla scelta riserva la commissione, quindi la mette da parte senza pagarla ancora. Quando il gestore verifica il codice e firma la conferma del ritiro, accredita la commissione una sola volta. Se invece il cliente non ritira, dopo la scadenza una transazione può liberare la riserva. Sono due esiti alternativi della prenotazione.

### Questo mercato potrebbe esistere senza blockchain?

Sì, è possibile costruire un mercato di offerte senza blockchain. Qui la scelta è affidare custodia e regole del budget a un contratto esterno verificabile. Nell’implementazione attuale, la riserva e il regolamento della commissione dipendono davvero da Avalanche. Il confronto commerciale deve ancora dimostrare che questo vantaggio vale la complessità aggiunta.

### La blockchain dimostra che il cliente ha ricevuto il cibo?

No. Il gestore controlla il codice e firma la conferma. La blockchain verifica e applica quella conferma, ma non vede il cibo. Contestazioni e pagamenti reali richiedono ulteriore lavoro prima di un servizio commerciale.

### Funziona oggi? Che cosa è simulato?

Possiamo usare richiesta, offerte, scelta e ritiro simulato. Il contratto esegue transazioni vere su Avalanche Fuji, che è una rete di prova. I locali della demo sono fittizi, non stiamo prenotando pasti e non usiamo denaro reale. Lo sponsor finanzia la prova. Le chiavi dei gestori registrati restano nel loro browser, mentre il server gestisce quelle delle attività fittizie. Il passaggio ai pagamenti reali resta da realizzare.

### Avete già fatto il test a Pescara?

No. Il pilota è proposto e i gestori devono essere reclutati. La precedente ipotesi di due locali e dieci studenti non era un test svolto né un limite di Food Arena. Vogliamo partire da una zona con locali e clienti vicini, raccogliere disponibilità reali e misurare ordini aggiuntivi, ritorno dei clienti, tempo del gestore e volontà di pagare il servizio.

### Avete dimostrato che è un business redditizio?

No. Abbiamo un prototipo tecnico e una proposta commerciale da verificare. Una commissione di 0,70 euro non dimostra da sola redditività. Dobbiamo misurare ordini ripetuti, lavoro di acquisizione e assistenza, costi tecnici e margine per ordine. La prova utile è che i locali continuino a usare il servizio e accettino di pagarlo.

### Quali verifiche tecniche avete completato?

Sono documentati 13 gruppi di test locali del contratto, 14 controlli su Fuji, 40 controlli di integrazione e 6 test SQL. L’integrazione comprende 45 richieste HTTP con massimo 12 operazioni concorrenti. Abbiamo provato anche la risposta AI e la firma dal browser del gestore, il percorso pubblico di scelta e ritiro e la vista mobile. Sono verifiche del prototipo, non un audit di produzione o una prova di mercato.

### Il codice è davvero aperto?

Sì. Il repository GitHub è pubblico con licenza MIT, che non scade. L’impegno è mantenere il repository pubblico almeno fino al 19 dicembre 2026.

## Collegamenti per la demo

- [Food Arena](https://food-arena.eldamarchigiano.chatgpt.site)
- [Contratto, saldi e prove Avalanche](https://food-arena.eldamarchigiano.chatgpt.site/mandato)
- [Codice pubblico](https://github.com/SPAZIOZEROLAB/food-arena)

Versione del 19 settembre 2026. Ipotesi commerciale: 0,70 euro per ritiro a carico del locale, non attiva. La demo usa soltanto fondi di prova.
