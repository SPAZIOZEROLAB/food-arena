# Food Arena — prova nuovo backend demo

**Archivio della versione precedente al mandato.** Il flusso attuale riserva e regola la commissione su Fuji. I controlli aggiornati si trovano in `docs/tests-budget-integration`; questo rapporto resta come evidenza storica, non come certificazione della nuova versione.

**PASS: 11 controlli**, 19 settembre 2026. Script `arena-test.cjs`, report `arena-result.json`. API locale `http://localhost:5173/api/passo`, nuova sessione cliente anonima, solo `demo: true`. Nessuna modifica ai sorgenti, accesso diretto al DB live o attestazione owner su Fuji.

| Prova | Evidenza |
|---|---|
| Arena anonima, budget 10 € | Tre offerte `scripted: 1`: 7,90 €, 8,50 €, 9,90 €, tutte entro il totale |
| Codici prima della scelta | Tutti e tre assenti dalla risposta |
| Scelta unica | Una `accepted`, due `cancelled`; codice soltanto per la scelta |
| Cliente estraneo con proprio cookie valido | `demoCollect` 403 e `demoAttest` 403 |
| Due persone, budget totale 17 € | Offerte totali 15,80 € e 17,00 €; bowl 19,80 € esclusa |
| Due persone vegetariane, budget 22 € | Stesse due offerte vegetariane; pollo escluso pur essendo economicamente ammissibile |
| Budget 7 €, sotto il minimo di 7,90 € | Zero offerte, richiesta ancora `open`; nessuno sconto inventato |
| Porta Nuova | Tre offerte con ID dei locali e indirizzi specifici della zona |
| Pescara centro | Tre offerte; nessun ID locale condiviso con Porta Nuova o Università/Viale Pindaro |
| Proprietario, codice errato | 400: `Codice di ritiro non corretto.` |
| Proprietario, codice giusto, doppio POST | Risposte 200 e 400; richiesta/offerta `collected`, prova hash presente, `tx_hash: null` |

La simulazione `demoCollect` è immediata per scelta esplicita del coordinatore; non è stata forzata l'ora del client/server o modificata la disponibilità. Il tentativo `demoAttest` estraneo è stato inviato prima del ritiro ed è stato fermato dall'autorizzazione. Lo script vieta espressamente qualunque chiamata `attest` o `demoAttest` dalla sessione proprietaria.

Durata 3.248 ms. Massimo due richieste attive contemporaneamente nel cookie proprietario, sotto il limite di tre. Pulizia verificata: sei richieste `cancelled` e una `collected`, tutte demo. Nessun dato precedente è stato modificato. I due sorgenti controllati sono rimasti invariati durante la run; gli hash sono nel report.

## Ripetere

Il server deve essere già attivo. La run crea sette richieste demo complessive usando due cookie cliente legittimi e consuma quota IP; se riceve 429 si ferma senza aggirarlo. Gli oggetti accessori della run vengono annullati tramite API.

```powershell
node docs/tests-arena/arena-test.cjs
```

Il report omette cookie e codici ritiro in chiaro. La prova copre il backend demo richiesto; non valida frontend, ranking AI o invio di transazioni Fuji.
