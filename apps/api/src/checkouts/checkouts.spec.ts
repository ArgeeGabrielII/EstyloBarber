describe('Estylo transaction ID format',()=>{
 it('documents required service/item prefixes',()=>{ expect('SVC-20260922-0001').toMatch(/^SVC-\d{8}-\d{4}$/); expect('ITEM-20260922-0001').toMatch(/^ITEM-\d{8}-\d{4}$/); });
});
