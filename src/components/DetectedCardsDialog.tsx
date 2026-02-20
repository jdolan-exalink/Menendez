import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { normalizationService } from '../services/normalization.service';
import { getProviderColor } from '../utils/providerColors';
import { Search, CreditCard, Check, Tag } from 'lucide-react';
import { cn } from '../lib/utils';

interface DetectedCardsDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (names: string[]) => void;
    alreadySelected: string[];
}

interface DetectedCard {
    name: string;
    provider: string;
    isNormalized: boolean;
    currentNormalization?: string;
}

export const DetectedCardsDialog: React.FC<DetectedCardsDialogProps> = ({
    open,
    onClose,
    onSelect,
    alreadySelected
}) => {
    const [loading, setLoading] = useState(true);
    const [cards, setCards] = useState<DetectedCard[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selected, setSelected] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            loadCards();
            setSelected([]);
            setSearchTerm('');
        }
    }, [open]);

    const loadCards = async () => {
        setLoading(true);
        try {
            const detected = await normalizationService.getDetectedOriginalNames();
            setCards(detected);
        } catch (error) {
            console.error('Error loading detected cards:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (name: string, isNormalized: boolean) => {
        if (isNormalized) return; // Can't select already normalized cards per requirement

        setSelected(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : [...prev, name]
        );
    };

    const handleConfirm = () => {
        onSelect(selected);
        onClose();
    };

    const filteredCards = cards.filter(card =>
        card.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent onClose={onClose}>
                <DialogHeader>
                    <DialogTitle>Tarjetas Detectadas</DialogTitle>
                    <DialogDescription>
                        Selecciona los nombres originales encontrados en tus transacciones para normalizar.
                    </DialogDescription>
                </DialogHeader>

                <DialogBody>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar tarjeta..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        <div className="border rounded-xl overflow-hidden bg-muted/20">
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                {loading ? (
                                    <div className="p-12 flex flex-col items-center justify-center space-y-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                        <p className="text-sm text-muted-foreground font-medium">Escaneando transacciones...</p>
                                    </div>
                                ) : filteredCards.length === 0 ? (
                                    <div className="p-12 text-center text-muted-foreground italic">
                                        No se encontraron tarjetas{searchTerm ? ` que coincidan con "${searchTerm}"` : ''}.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/10">
                                        {filteredCards.map((card) => {
                                            const isForbidden = card.isNormalized && !alreadySelected.includes(card.name);
                                            const isSelected = selected.includes(card.name);
                                            const cardKey = `${card.name}-${card.provider}`;

                                            return (
                                                <div
                                                    key={cardKey}
                                                    onClick={() => toggleSelect(card.name, isForbidden)}
                                                    className={cn(
                                                        "flex items-center justify-between p-4 transition-all duration-200",
                                                        isForbidden ? "opacity-50 cursor-not-allowed bg-muted/30" : "cursor-pointer hover:bg-primary/5",
                                                        isSelected && "bg-primary/10"
                                                    )}
                                                >
                                                    <div className="flex items-center space-x-3 flex-1">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-lg flex items-center justify-center",
                                                            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                                        )}>
                                                            <CreditCard className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <p className="font-bold text-sm tracking-tight">{card.name}</p>
                                                                <span
                                                                    className="px-2 py-0.5 rounded-md text-white text-[10px] font-bold uppercase tracking-wider"
                                                                    style={{
                                                                        backgroundColor: getProviderColor(card.provider)
                                                                    }}
                                                                >
                                                                    {card.provider}
                                                                </span>
                                                            </div>
                                                            {card.isNormalized && (
                                                                <p className="text-[10px] text-primary font-bold uppercase tracking-wider flex items-center">
                                                                    <Tag className="h-2 w-2 mr-1" />
                                                                    Ya en: {card.currentNormalization}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!isForbidden && (
                                                        <div className={cn(
                                                            "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                                                            isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                                                        )}>
                                                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogBody>

                <DialogFooter>
                    <div className="flex-1 flex items-center text-xs font-medium text-muted-foreground">
                        {selected.length} seleccionadas
                    </div>
                    <Button variant="ghost" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={selected.length === 0}
                        className="shadow-md"
                    >
                        Agregar Seleccionadas
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
