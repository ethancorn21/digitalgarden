2026-02-27 11:05
status: #baby
tags: [[school]], [[Technology]], [[webdev]]

---
# Modals, Carousels, and Forms in Bootstrap

##  Modals
**Key Concept:** A "modal" is a dialog box/popup window that sits on top of the main page to capture user focus.
### Modal Code Structure
```html
<button type="button" class="btn btn-primary" data-toggle="modal" data-target="#myModal">
  Open Modal
</button>

<div class="modal" id="myModal">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h4 class="modal-title">Header</h4>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body">
        Any HTML content (images, forms, etc.) goes here.
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-danger" data-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>
```

---
##  Carousels

**Key Concept:** A slideshow component for cycling through a series of content.
### Carousel Code Structure
```html
<div id="studyCarousel" class="carousel slide" data-ride="carousel" data-interval="4000">
  <div class="carousel-inner">
    <div class="carousel-item">
      <img src="img1.jpg" alt="First">
    </div>
    <div class="carousel-item active"> 
      <img src="img2.jpg" alt="Second">
    </div>
  </div>
  <a class="carousel-control-prev" href="#studyCarousel" data-slide="prev">
    <span class="carousel-control-prev-icon"></span>
  </a>
</div>
```

---
## Forms

**Key Concept:** Standardized styling for inputs, labels, and layout groups.

### Form Code Structure
```HTML
<form>
  <div class="form-group mb-3">
    <label for="userEmail">Email Address</label>
    <input type="email" class="form-control" id="userEmail" placeholder="name@example.com">
  </div>
  <div class="row">
    <div class="col-md-6">
      <label>First Name</label>
      <input type="text" class="form-control">
    </div>
    <div class="col-md-6">
      <label>Last Name</label>
      <input type="text" class="form-control">
    </div>
  </div>
</form>
```
---
## see also:

