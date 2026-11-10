import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Plus,
  Check,
  Building2,
  Users,
  FileText,
} from 'lucide-react';
import { Customer, InventoryDebt, Receipt } from '../types';
import { StorageService } from '../services/storage';
import { t } from '../utils/i18n';

export interface ClientOption {
  id: string;
  name: string;
  contact?: string;
  email?: string;
  location?: string;
  taxNumber?: string;
  profilePic?: string;
  source?: 'inventory' | 'debt' | 'receipt' | 'invoice' | 'agent';
}

interface ClientPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectClient: (client: ClientOption) => void;
  language?: string;
}

export const ClientPickerModal: React.FC<ClientPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectClient,
  language,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // New client inline form state
  const [newName, setNewName] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newLocation, setNewLocation] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    // Load inventory clients
    const inventoryCustomers: Customer[] = StorageService.getCustomers();
    const inventoryDebts: InventoryDebt[] = StorageService.getInventoryDebts();
    const pastReceipts: Receipt[] = StorageService.getReceipts();

    const clientMap = new Map<string, ClientOption>();

    // 1. First add inventory customers (highest priority)
    inventoryCustomers.forEach((c) => {
      const key = (c.name || '').trim().toLowerCase();
      if (key && !clientMap.has(key)) {
        clientMap.set(key, {
          id: c.id,
          name: c.name.trim(),
          contact: c.contact,
          email: c.email,
          location: c.location,
          profilePic: c.profilePic,
          source: 'inventory',
        });
      }
    });

    // 2. Add debtors if not in inventory customers
    inventoryDebts.forEach((d) => {
      const name = (d.customerName || '').trim();
      const key = name.toLowerCase();
      if (name && !clientMap.has(key)) {
        clientMap.set(key, {
          id: d.id,
          name: name,
          contact: d.phone,
          source: 'debt',
        });
      }
    });

    // 3. Add past receipt/invoice customers
    pastReceipts.forEach((r) => {
      const name = (r.customerName || '').trim();
      const key = name.toLowerCase();
      if (
        name &&
        name.toLowerCase() !== 'walk-in customer' &&
        name.toLowerCase() !== 'general customer' &&
        !clientMap.has(key)
      ) {
        const isInvoice =
          r.documentType === 'invoice' ||
          (r.receiptNumber && r.receiptNumber.toUpperCase().startsWith('INV'));
        clientMap.set(key, {
          id: r.id,
          name: name,
          contact: r.customerPhone,
          email: r.customerEmail,
          location: r.customerAddress,
          taxNumber: r.customerTaxNumber,
          source: isInvoice ? 'invoice' : 'receipt',
        });
      }
    });

    // 4. Add agents if not already present
    try {
      const agents = StorageService.getAgents();
      agents.forEach((a) => {
        const name = (a.agentName || '').trim();
        const key = name.toLowerCase();
        if (name && !clientMap.has(key)) {
          clientMap.set(key, {
            id: a.id,
            name: name,
            contact: a.contact,
            email: a.email,
            location: a.address,
            profilePic: a.profilePic,
            source: 'agent',
          });
        }
      });
    } catch (_) {}

    setClients(Array.from(clientMap.values()));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const filteredClients = clients.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.contact && c.contact.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q))
    );
  });

  const handleAddNewClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const created = StorageService.addCustomer({
      name: newName.trim(),
      contact: newContact.trim(),
      email: newEmail.trim() || undefined,
      location: newLocation.trim() || undefined,
    });

    const newOption: ClientOption = {
      id: created.id,
      name: created.name,
      contact: created.contact,
      email: created.email,
      location: created.location,
      source: 'inventory',
    };

    onSelectClient(newOption);
    onClose();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Select Client
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose a client from inventory or recent records
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {!showAddForm ? (
            <>
              {/* Search & Actions Bar */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search client by name, phone, email..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition active:scale-95 shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Client</span>
                </button>
              </div>

              {/* Clients List */}
              {filteredClients.length > 0 ? (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredClients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => {
                        onSelectClient(client);
                        onClose();
                      }}
                      className="group p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-800/80 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition cursor-pointer flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Profile avatar / initials */}
                        {client.profilePic ? (
                          <img
                            src={client.profilePic}
                            alt={client.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-sm flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-800/60 uppercase">
                            {client.name.substring(0, 2)}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {client.name}
                            </h4>
                            {client.source === 'inventory' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                                Inventory
                              </span>
                            )}
                            {client.source === 'receipt' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                                Receipt
                              </span>
                            )}
                            {client.source === 'invoice' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60 shrink-0">
                                Invoice
                              </span>
                            )}
                            {client.source === 'debt' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
                                Debtor
                              </span>
                            )}
                            {client.source === 'agent' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/60 shrink-0">
                                Agent
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {client.contact && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {client.contact}
                              </span>
                            )}
                            {client.email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3 text-slate-400" />
                                {client.email}
                              </span>
                            )}
                            {client.location && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                {client.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white dark:bg-indigo-950/80 dark:group-hover:bg-indigo-600 dark:text-indigo-300 text-xs font-bold transition shrink-0 flex items-center gap-1"
                      >
                        <span>Select</span>
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No clients found
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery
                        ? 'Try searching with another name or phone number'
                        : 'No clients saved in inventory yet'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create New Client</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Quick Add Client Inline Form */
            <form onSubmit={handleAddNewClient} className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  New Client Details
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                >
                  Back to List
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Client Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Acme Corp / John Doe"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phone / Contact
                </label>
                <input
                  type="text"
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  placeholder="e.g. +256 700 000 000"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="billing@company.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Address / Location
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Plot 10, Industrial Park"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition"
                >
                  Save & Use Client
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
