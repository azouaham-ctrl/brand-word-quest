import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Download, Sparkles, Search } from "lucide-react";
import { toast } from "sonner";

const FIELDS = [
  "General English",
  "Medical / Health",
  "Technology / Computing",
  "Science (General)",
  "Business / Finance",
  "Marketing / Branding",
  "Psychology / Sociology",
  "Literature / Archaic",
];

const POS_TYPES = [
  { value: "any", label: "Any" },
  { value: "noun", label: "Noun" },
  { value: "adjective", label: "Adjective" },
  { value: "verb", label: "Verb" },
];

interface WordResult {
  word: string;
  score: number;
  brand: number;
  rarity: number;
  sentiment: number;
  domainAvailable: boolean;
  domainScore: number;
  length: number;
}

const Index = () => {
  const [selectedFields, setSelectedFields] = useState<string[]>(["General English"]);
  const [minLength, setMinLength] = useState("5");
  const [maxLength, setMaxLength] = useState("8");
  const [firstLetter, setFirstLetter] = useState("");
  const [posType, setPosType] = useState("any");
  const [minRarity, setMinRarity] = useState("3");
  const [maxRarity, setMaxRarity] = useState("5");
  const [brandMode, setBrandMode] = useState(false);
  const [maxResults, setMaxResults] = useState("50");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const toggleField = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field]
    );
  };

  const handleSearch = async () => {
    if (selectedFields.length === 0) {
      toast.error("Please select at least one field");
      return;
    }

    setIsSearching(true);
    setResults([]);
    toast.info("Extracting rare words...");

    try {
      const criteria = {
        fields: selectedFields,
        lengthRange: [parseInt(minLength) || 3, parseInt(maxLength) || 15] as [number, number],
        firstLetter: firstLetter || undefined,
        posType: posType === "any" ? undefined : posType,
        rarityRange: [parseInt(minRarity) || 1, parseInt(maxRarity) || 5] as [number, number],
        brandMode,
        maxResults: parseInt(maxResults) || 50,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-words`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(criteria),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
      toast.success(`Found ${data.length} rare words!`);
    } catch (error) {
      console.error("Error extracting words:", error);
      toast.error("Failed to extract words. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const exportResults = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rare-words-${Date.now()}.json`;
    link.click();
    toast.success("Results exported successfully!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-gradient-to-r from-primary/10 to-accent/10 rounded-full">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              AI-Powered Word Discovery
            </span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
            Rare Word Extractor
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover unique, brandable words with advanced filtering and domain availability scoring
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Filters Panel */}
          <Card className="lg:col-span-1 p-6 shadow-elegant border-border/50">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Search Criteria
            </h2>

            <div className="space-y-6">
              {/* Field Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Source Fields</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {FIELDS.map(field => (
                    <div key={field} className="flex items-center space-x-2">
                      <Checkbox
                        id={field}
                        checked={selectedFields.includes(field)}
                        onCheckedChange={() => toggleField(field)}
                      />
                      <label
                        htmlFor={field}
                        className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {field}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Length Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="minLength">Min Length</Label>
                  <Input
                    id="minLength"
                    type="number"
                    min="2"
                    max="15"
                    value={minLength}
                    onChange={(e) => setMinLength(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="maxLength">Max Length</Label>
                  <Input
                    id="maxLength"
                    type="number"
                    min="2"
                    max="15"
                    value={maxLength}
                    onChange={(e) => setMaxLength(e.target.value)}
                  />
                </div>
              </div>

              {/* First Letter */}
              <div>
                <Label htmlFor="firstLetter">First Letter (optional)</Label>
                <Input
                  id="firstLetter"
                  maxLength={1}
                  placeholder="e.g., z"
                  value={firstLetter}
                  onChange={(e) => setFirstLetter(e.target.value)}
                />
              </div>

              {/* POS Type */}
              <div>
                <Label htmlFor="posType">Part of Speech</Label>
                <Select value={posType} onValueChange={setPosType}>
                  <SelectTrigger id="posType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POS_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rarity Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="minRarity">Min Rarity</Label>
                  <Input
                    id="minRarity"
                    type="number"
                    min="1"
                    max="5"
                    value={minRarity}
                    onChange={(e) => setMinRarity(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="maxRarity">Max Rarity</Label>
                  <Input
                    id="maxRarity"
                    type="number"
                    min="1"
                    max="5"
                    value={maxRarity}
                    onChange={(e) => setMaxRarity(e.target.value)}
                  />
                </div>
              </div>

              {/* Brand Mode */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-primary/10">
                <div>
                  <Label htmlFor="brandMode" className="font-semibold">Brand Mode</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Prioritize .com availability
                  </p>
                </div>
                <Switch
                  id="brandMode"
                  checked={brandMode}
                  onCheckedChange={setBrandMode}
                />
              </div>

              {/* Max Results */}
              <div>
                <Label htmlFor="maxResults">Max Results</Label>
                <Input
                  id="maxResults"
                  type="number"
                  min="10"
                  max="200"
                  value={maxResults}
                  onChange={(e) => setMaxResults(e.target.value)}
                />
              </div>

              {/* Search Button */}
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className="w-full bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 transition-opacity"
                size="lg"
              >
                {isSearching ? "Searching..." : "Extract Words"}
              </Button>
            </div>
          </Card>

          {/* Results Panel */}
          <Card className="lg:col-span-2 p-6 shadow-elegant border-border/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                Results {results.length > 0 && `(${results.length})`}
              </h2>
              {results.length > 0 && (
                <Button onClick={exportResults} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </Button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No results yet</h3>
                <p className="text-muted-foreground">
                  Configure your search criteria and click "Extract Words" to begin
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-gradient-to-r from-card to-secondary/30 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                  >
                     <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-primary">
                          {result.word}
                        </span>
                        {result.meta?.domain_available && (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            .com available
                          </Badge>
                        )}
                      </div>
                      <Badge variant="secondary" className="font-mono">
                        Score: {((result.meta?.brand || 0) * 0.35 + (result.meta?.rarity || 0) * 2 * 0.20).toFixed(1)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Brand:</span>{" "}
                        <span className="font-semibold">{(result.meta?.brand || 0).toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rarity:</span>{" "}
                        <span className="font-semibold">{(result.meta?.rarity || 0).toFixed(1)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sentiment:</span>{" "}
                        <span className="font-semibold">{(result.meta?.sentiment || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Domain:</span>{" "}
                        <span className="font-semibold">{((result.meta?.domain_score || 0) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
