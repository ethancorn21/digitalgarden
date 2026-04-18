2026-02-27 10:36
status:
tags: [[school]]; [[technology]]; [[webdev]]

---
# Cards and Navbars in Bootstrap
## Bootstrap Cards
Cards are flexible content containers. The "Gold Standard" for layouts like staff directories or product grids.
### Proper Structure
The most common mistake is forgetting the `.card-body` wrapper. Without it, text will lack padding and touch the card borders.
```html
<div class="card">
  <div class="card-body">
    <p class="card-text">Content goes here.</p>
  </div>
</div>
```

---

## 🗺️ Bootstrap Navbars

Navbars are responsive meta-components that serve as navigation headers.

---

## 💡 Key Takeaways for the Class

- **Target & ID Synchronization:** If the mobile menu doesn't open, check that the button's `data-bs-target` matches the menu's `id` exactly.    
- **Responsive Breakpoints:** Classes like `.navbar-expand-lg` determine at what screen width the menu switches from a "hamburger" to a full horizontal list.
- **Z-Index & Padding:** When using `.fixed-top`, the navbar "floats" above the page. You must add `margin-top` or `padding-top` to your body content so it isn't hidden behind the bar.

---

## 🛠️ Quick Reference Code

HTML

```
<nav class="navbar navbar-expand-lg navbar-dark bg-dark fixed-top">
  <div class="container-fluid">
    <a class="navbar-brand" href="#">Logo</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navMenu">
      <ul class="navbar-nav ms-auto">
        <li class="nav-item"><a class="nav-link active" href="#">Home</a></li>
        <li class="nav-item"><a class="nav-link" href="#">About</a></li>
      </ul>
    </div>
  </div>
</nav>

<div class="card" style="width: 18rem;">
  <img src="..." class="card-img-top" alt="Card Image">
  <div class="card-body">
    <h5 class="card-title">Card Title</h5>
    <p class="card-text">Example text for the card body.</p>
    <a href="#" class="btn btn-primary">Go somewhere</a>
  </div>
</div>
```

---
## see also:

