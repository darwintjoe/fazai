'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { db, type Contact } from '@/lib/fazai-db';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ContactStatement } from '@/components/fazai/contact-statement';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil } from 'lucide-react';
import { v4 as uuid } from 'uuid';

export function Contacts() {
  const { lang } = useAuthStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [tab, setTab] = useState<'list' | 'statement'>('list');

  const loadContacts = useCallback(async () => {
    const list = await db.contacts.orderBy('name').toArray();
    setContacts(list);
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const q = query.trim().toLowerCase();
  const filtered = contacts.filter(c =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.company.toLowerCase().includes(q) ||
    c.phone.includes(q)
  );

  const startAdd = () => {
    setEditContact(null);
    setName(query.trim());
    setCompany('');
    setPhone('');
    setShowDialog(true);
  };

  const startEdit = (c: Contact) => {
    setEditContact(c);
    setName(c.name);
    setCompany(c.company);
    setPhone(c.phone);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editContact) {
      await db.contacts.update(editContact.id, { name: name.trim(), company: company.trim(), phone: phone.trim(), updatedAt: new Date() });
    } else {
      await db.contacts.add({ id: `ctc-${uuid()}`, name: name.trim(), company: company.trim(), phone: phone.trim(), isActive: true, createdAt: new Date(), updatedAt: new Date() });
    }
    setShowDialog(false);
    setEditContact(null);
    setName('');
    setCompany('');
    setPhone('');
    await loadContacts();
  };

  const toggleActive = async (c: Contact) => {
    await db.contacts.update(c.id, { isActive: !c.isActive, updatedAt: new Date() });
    await loadContacts();
  };

  return (
    <div className="flex flex-col gap-4 pb-20 lg:pb-10">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-bold">{t('contact.title', lang)}</h2>
        <Button size="sm" onClick={startAdd} className="ml-auto">
          <Plus className="w-4 h-4 mr-1" /> {t('contact.add', lang)}
        </Button>
      </div>
      <div className="flex gap-1.5">
        {(['list', 'statement'] as const).map(v => (
          <Button key={v} size="sm" variant={tab === v ? 'default' : 'outline'} className="h-7 text-[11px] px-3 rounded-full capitalize" onClick={() => setTab(v)}>
            {v === 'list' ? (lang === 'id' ? 'Daftar' : lang === 'zh' ? '列表' : 'List') : (lang === 'id' ? 'Pernyataan' : lang === 'zh' ? '对账单' : 'Statement')}
          </Button>
        ))}
      </div>
      {tab === 'statement' ? (
        <Card className="overflow-hidden"><div className="overflow-x-auto p-4"><ContactStatement /></div></Card>
      ) : (
      <>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('contact.search', lang)} />
      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <Card key={c.id} className={`p-3 flex items-center gap-3 ${!c.isActive ? 'opacity-50' : ''}`}>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{c.name}</p>
              {(c.company || c.phone) && (
                <p className="text-xs text-muted-foreground truncate">{[c.company, c.phone].filter(Boolean).join(' • ')}</p>
              )}
            </div>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => startEdit(c)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggleActive(c)}>
                {c.isActive ? t('contact.deactivate', lang) : t('contact.activate', lang)}
              </Button>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">{t('contact.noFound', lang)}</p>
        )}
      </div>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editContact ? t('contact.edit', lang) : t('contact.add', lang)}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('contact.name', lang)} />
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t('contact.company', lang)} />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('contact.phone', lang)} />
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!name.trim()}>{t('contact.save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
    </div>
  );
}
