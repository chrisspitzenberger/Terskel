"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Settings, Heart, Gauge, Globe, Database, Trash2 } from "lucide-react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { clearAllData } from "@/lib/db/indexed-db"

export default function SettingsPage() {
  const [language, setLanguage] = useState("de")
  const [units, setUnits] = useState("metric")
  const [defaultHrMax, setDefaultHrMax] = useState([185])
  const [autoAnalyze, setAutoAnalyze] = useState(true)
  const [showAdvancedStats, setShowAdvancedStats] = useState(false)

  const handleClearData = async () => {
    await clearAllData()
    window.location.reload()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Einstellungen</h1>
          <p className="text-muted-foreground">App-Einstellungen und Praferenzen</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Allgemein
            </CardTitle>
            <CardDescription>Sprache und Einheiten</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="language">Sprache</Label>
                <p className="text-sm text-muted-foreground">
                  Anzeigesprache der App
                </p>
              </div>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="units">Einheiten</Label>
                <p className="text-sm text-muted-foreground">
                  Metrisch (km) oder Imperial (mi)
                </p>
              </div>
              <Select value={units} onValueChange={setUnits}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metrisch (km)</SelectItem>
                  <SelectItem value="imperial">Imperial (mi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Training Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Training
            </CardTitle>
            <CardDescription>Standardwerte fur Trainings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="hr-max">Standard maximale Herzfrequenz</Label>
                <span className="text-sm font-medium">{defaultHrMax[0]} bpm</span>
              </div>
              <Slider
                id="hr-max"
                value={defaultHrMax}
                onValueChange={setDefaultHrMax}
                min={140}
                max={220}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Wird fur Zonenberechnungen verwendet, wenn kein individueller Wert vorliegt.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Analyse
            </CardTitle>
            <CardDescription>Einstellungen fur Datenanalyse</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-analyze">Automatische Analyse</Label>
                <p className="text-sm text-muted-foreground">
                  Nach Testabschluss automatisch Schwellen berechnen
                </p>
              </div>
              <Switch 
                id="auto-analyze" 
                checked={autoAnalyze} 
                onCheckedChange={setAutoAnalyze}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="advanced-stats">Erweiterte Statistiken</Label>
                <p className="text-sm text-muted-foreground">
                  Zusatzliche Metriken und Diagramme anzeigen
                </p>
              </div>
              <Switch 
                id="advanced-stats" 
                checked={showAdvancedStats} 
                onCheckedChange={setShowAdvancedStats}
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Daten
            </CardTitle>
            <CardDescription>Datenverwaltung und -speicher</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Alle Daten werden lokal auf diesem Gerat gespeichert. 
                Cloud-Synchronisation wird in einer zukunftigen Version verfugbar sein.
              </p>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Alle Daten loschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Alle Daten loschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht ruckgangig gemacht werden. Alle Trainings und 
                    Stufentests werden dauerhaft von diesem Gerat geloscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearData}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Loschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>Uber Terskel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Terskel ist eine App zur Trainingsanalyse und Leistungsdiagnostik 
              fur Ausdauersportler. Der Name &quot;Terskel&quot; kommt aus dem Norwegischen 
              und bedeutet &quot;Schwelle&quot;.
            </p>
            <p className="text-xs text-muted-foreground">
              Version 1.0.0 (Beta)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
