# Laktatschwellen-Berechnung in Terskel

Die Terskel-App nutzt moderne, sportwissenschaftlich validierte Methoden zur Bestimmung der Laktatschwellen (LT1 und LT2). Anstatt sich nur auf feste (oft ungenaue) Werte zu verlassen, analysiert die App die individuelle Laktatkinetik (die Kurvenform) des Athleten.

Hier ist im Detail dokumentiert, wie und wann die App welche Berechnungsmethode anwendet.

---

## 1. Kurvenanpassung (Curve Fitting)

Bevor Schwellen ermittelt werden können, muss aus den einzelnen Messpunkten des Stufentests eine kontinuierliche Kurve gebildet werden. 

Die App wendet folgende Methoden an (in absteigender Priorität):

1. **Polynom 3. Grades (Primäre Methode):**
   - **Formel:** `La(v) = a·v³ + b·v² + c·v + d`
   - **Wann es genutzt wird:** Dies ist der Standard. Es wird genutzt, wenn das Bestimmtheitsmaß ($R^2$) mindestens `0.90` beträgt und die Kurve physiologisch plausibel ist (sie muss bei höheren Geschwindigkeiten ansteigen).
   - **Warum:** Polynome 3. Grades modellieren den typischen Laktatverlauf (erst flach, dann exponentiell ansteigend) für die meisten Athleten am besten.

2. **Exponentialfunktion (Fallback):**
   - **Formel:** `La(v) = a + b·e^(c·v)`
   - **Wann es genutzt wird:** Wenn das Polynom fehlschlägt (z. B. $R^2 < 0.90$ oder die Kurve sinkt am Ende ab).
   - **Warum:** Eine Exponentialkurve erzwingt einen Anstieg und ist robuster bei "unsauberen" Daten, fittet aber manchmal im unteren Bereich nicht ganz so genau wie das Polynom.

---

## 2. LT1: Aerobe Schwelle (Erster Laktatanstieg)

Die LT1 markiert den Übergang vom rein aeroben Fettstoffwechsel zum moderaten Kohlenhydratstoffwechsel. Hier beginnt das Laktat erstmals leicht zu steigen.

1. **Log-Log Breakpoint Methode (Primär):**
   - **Wie es funktioniert:** Die App wandelt Geschwindigkeit und Laktat auf eine logarithmische Skala um. Dann sucht sie nach einem "Knick" (Breakpoint) in den Daten, indem sie zwei gerade Linien (lineare Regressionen) an die Datenpunkte anpasst. Der Punkt, an dem der Gesamtfehler beider Linien am geringsten ist, ist die LT1.
   - **Wann es genutzt wird:** Standardmäßig, solange der gefundene Punkt physiologisch Sinn ergibt (darf nicht zu nah am Testende sein und Laktat muss < 2.5 mmol/L sein).

2. **Baseline + 0.4 mmol/L (Norwegisches Modell / Fallback):**
   - **Wie es funktioniert:** Die App sucht den niedrigsten gemessenen Laktatwert im Test (die Baseline). Die LT1 wird exakt dort gesetzt, wo die Kurve den Wert `Baseline + 0.4` erreicht.
   - **Wann es genutzt wird:** Wenn die Log-Log-Methode keinen klaren Punkt findet oder unplausible Werte liefert. Diese Methode ist extrem robust und wird auch vom norwegischen Verband häufig im Training genutzt.

---

## 3. LT2: Anaerobe Schwelle (MLSS / ANS)

Die LT2 (oft Anaerobe Schwelle genannt) ist das Maximum Lactate Steady State (MLSS). Es ist die höchste Intensität, bei der Laktatproduktion und Laktatabbau noch im Gleichgewicht sind.

1. **ModDmax-Methode (Modifiziertes Dmax, Primär):**
   - **Wie es funktioniert:** 
     1. Es wird eine gerade Linie (Sekante) vom *ersten* zum *letzten* Messpunkt gezogen.
     2. Die App sucht auf der berechneten Kurve (Polynom oder Exponential) genau den Punkt, der den **größten senkrechten Abstand** zu dieser Linie hat.
   - **Wann es genutzt wird:** Dies ist der absolute Goldstandard der App und wird immer verwendet, wenn eine gültige Kurve (Polynom oder Exponential) vorliegt.
   - **Warum:** Studien zeigen, dass das ModDmax-Verfahren die genaueste Vorhersage für das tatsächliche MLSS und die Wettkampfleistung liefert, da es die gesamte, individuelle Kurvenform des Athleten berücksichtigt.

2. **OBLA / Fixwert-Methode 4.0 mmol/L (Absoluter Notfall-Fallback):**
   - **Wie es funktioniert:** Die Schwelle wird fix bei einem Laktatwert von `4.0 mmol/L` gesetzt (Onset of Blood Lactate Accumulation nach Sjödin & Jacobs).
   - **Wann es genutzt wird:** NUR, wenn die Kurvenanpassung völlig fehlschlägt (z.B. bei extrem sprunghaften Datenfehlern) oder wenn die ModDmax-Methode geometrisch unmöglich ist (z.B. LT2 berechnet sich fälschlicherweise auf ein langsameres Tempo als LT1).
   - **Warum:** Der fixe Wert von 4.0 mmol/L ist individuell oft sehr ungenau (einige Profis haben ihr MLSS bei 2.5 mmol/L, andere bei 5.5 mmol/L). Er dient daher hier nur als letzte Rettung, damit die App nicht abstürzt.

---

## Zusammenfassung der Validierungen

Die App rechnet nicht blind, sondern prüft die Ergebnisse auf Plausibilität:
- Es müssen mindestens 3 Messpunkte vorliegen (unter 5 Messpunkten gibt es eine Warnung).
- Das maximale Laktat sollte über 4.0 mmol/L liegen, sonst ist der Test eigentlich nicht voll ausbelastet.
- Die Laktatkurve muss (nach einem anfänglichen leichten Absinken) stetig ansteigen.
- **LT2 muss zwingend schneller sein als LT1.** Ist dies nicht der Fall, greifen die oben beschriebenen Fallback-Methoden.
